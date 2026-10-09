"""Tests for scripts/release-datasets.py: reproducible zips, release notes and the create/replace/skip plan. No network."""

from __future__ import annotations

import contextlib
import hashlib
import importlib.util
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "release-datasets.py"
REPO = "o/r"
DASHES = (chr(0x2014), chr(0x2013))


def load_module():
    spec = importlib.util.spec_from_file_location("release_datasets", SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load {SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


MOD = load_module()

FIXTURES = {
    "india-repo-rate-dataset": {
        "version": "2.0.0",
        "generated_at": "2026-10-05",
        "coverage": {"daily_to": "2026-10-04"},
        "rates": 91,
        "releases": [("IN", "a" * 64)],
    },
    "alpha-test-dataset": {
        "version": "1.2.0",
        "generated_at": "2026-10-07",
        "coverage": {},
        "rates": 1234,
        "releases": [("US", "b" * 64), ("IN", "a" * 64)],
    },
}


def make_tree(tmp: Path, fixtures: dict | None = None) -> Path:
    """Fake hf/ root: manifest, a nested parquet file and a .DS_Store per dataset."""
    root = tmp / "hf"
    for name, spec in (fixtures or FIXTURES).items():
        folder = root / name
        (folder / "provenance").mkdir(parents=True)
        (folder / "data" / "nested").mkdir(parents=True)
        manifest = {
            "repo_id": f"owner/{name}",
            "version": spec["version"],
            "generated_at": spec["generated_at"],
            "coverage": spec["coverage"],
            "record_counts_by_config": {"rates": spec["rates"], "daily": 5},
            "releases": [{"country_code": cc, "hash": h} for cc, h in spec["releases"]],
        }
        (folder / "provenance" / "build-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        (folder / "README.md").write_text(f"# {name}\n", encoding="utf-8")
        (folder / "data" / "x.parquet").write_bytes(name.encode() * 50)
        (folder / "data" / "nested" / "y.parquet").write_bytes(b"\x00\x01" + name.encode())
        (folder / ".DS_Store").write_bytes(b"junk")
        (folder / "data" / ".DS_Store").write_bytes(b"junk")
    return root


def completed(args, code=0, out="", err=""):
    return subprocess.CompletedProcess(args, code, out, err)


class StubGh:
    """Records gh argv (after "gh") and answers the read calls the script makes."""

    def __init__(self, tags=(), sums=None, assets=None, list_error=None, create_error=None, fail_on=None):
        self.calls: list[list[str]] = []
        self.tags = list(tags)
        self.sums = dict(sums or {})
        self.assets = dict(assets or {})
        self.list_error = list_error
        self.create_error = create_error
        self.fail_on = fail_on

    def __call__(self, args):
        args = list(args)
        self.calls.append(args)
        if self.fail_on and args[:2] == self.fail_on:
            return completed(args, 1, "", "boom")
        if args[:2] == ["release", "list"]:
            if self.list_error:
                return completed(args, 1, "", self.list_error)
            return completed(args, 0, json.dumps([{"tagName": t} for t in self.tags]))
        if args[:2] == ["release", "download"]:
            tag = args[2]
            if tag in self.sums:
                return completed(args, 0, self.sums[tag])
            return completed(args, 1, "", "no assets match the file pattern")
        if args[:2] == ["release", "view"]:
            names = self.assets.get(args[2], [])
            return completed(args, 0, json.dumps({"assets": [{"name": n} for n in names]}))
        if args[:2] == ["release", "create"] and self.create_error:
            self.tags.append(args[2])
            error, self.create_error = self.create_error, None
            return completed(args, 1, "", error)
        return completed(args)

    def writes(self):
        return [c for c in self.calls if c[:2] not in (["release", "list"], ["release", "view"], ["release", "download"])]


class ReleaseDatasetsTest(unittest.TestCase):
    maxDiff = None

    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory(prefix="release-datasets-")
        self.addCleanup(tmp.cleanup)
        self.tmp = Path(tmp.name)
        self.root = make_tree(self.tmp)
        self.datasets = MOD.load_datasets(self.root)

    def build(self, out_name="out"):
        out = self.tmp / out_name
        out.mkdir(exist_ok=True)
        return MOD.build_assets(self.datasets, out)

    def run_main(self, stub, *extra, out_name="main-out"):
        out = io.StringIO()
        err = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = MOD.main(["--repo", REPO, "--out", str(self.tmp / out_name), *extra], run=stub, hf_root=self.root)
        return code, out.getvalue(), err.getvalue()

    # 1. determinism
    def test_zip_is_deterministic(self):
        first = self.build("a")
        second = self.build("b")
        self.assertEqual([(a.name, a.sha256) for a in first], [(a.name, a.sha256) for a in second])

    def test_zip_ignores_mtimes_and_write_order(self):
        baseline = {a.name: a.path.read_bytes() for a in self.build("a")}
        copy = self.tmp / "copy" / "hf"
        files = sorted(p for p in self.root.rglob("*") if p.is_file())
        for i, src in enumerate(reversed(files)):
            dest = copy / src.relative_to(self.root)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dest)
            os.utime(dest, (1_000_000 + i * 9973, 1_000_000 + i * 9973))
        out = self.tmp / "b"
        out.mkdir()
        rebuilt = {a.name: a.path.read_bytes() for a in MOD.build_assets(MOD.load_datasets(copy), out)}
        self.assertEqual(baseline.keys(), rebuilt.keys())
        for name in baseline:
            if name.endswith(".zip"):
                self.assertEqual(baseline[name], rebuilt[name], name)

    # 2. layout
    def test_zip_layout(self):
        self.build()
        for ds in self.datasets:
            folder = self.root / ds.folder.name
            path = self.tmp / "out" / MOD.zip_name(ds)
            with zipfile.ZipFile(path) as zf:
                names = zf.namelist()
                self.assertEqual(names, sorted(names))
                self.assertTrue(all(n.startswith(f"{ds.folder.name}/") for n in names))
                self.assertFalse(any(n.endswith("/") for n in names))
                self.assertFalse(any(".DS_Store" in n for n in names))
                self.assertEqual(zf.comment, b"")
                expected = {f"{ds.folder.name}/{p.relative_to(folder).as_posix()}" for p in folder.rglob("*") if p.is_file() and p.name != ".DS_Store"}
                self.assertEqual(set(names), expected)
                for info in zf.infolist():
                    self.assertEqual(info.date_time, MOD.ZIP_TIME)
                    self.assertEqual(info.external_attr, MOD.ZIP_MODE)
                    self.assertEqual(info.create_system, 3)
                    rel = info.filename.split("/", 1)[1]
                    self.assertEqual(zf.read(info), (folder / rel).read_bytes())

    # 3. SHA256SUMS
    def test_sums(self):
        assets = self.build()
        text = MOD.render_sums(assets)
        lines = text.splitlines()
        self.assertTrue(text.endswith("\n"))
        self.assertEqual(lines, sorted(lines, key=lambda l: l.split("  ", 1)[1]))
        self.assertEqual(len(lines), len(self.datasets))
        for line in lines:
            digest, name = line.split("  ", 1)
            self.assertTrue(name.endswith(".zip"))
            self.assertEqual(digest, hashlib.sha256((self.tmp / "out" / name).read_bytes()).hexdigest())

    # 4. tag and discovery
    def test_tag_is_newest_generated_at_in_any_order(self):
        self.assertEqual(MOD.release_tag(self.datasets), "datasets-2026-10-07")
        self.assertEqual(MOD.release_tag(list(reversed(self.datasets))), "datasets-2026-10-07")

    def test_bad_date_raises(self):
        bad = {"x-dataset": {**FIXTURES["alpha-test-dataset"], "generated_at": "07-10-2026"}}
        root = make_tree(self.tmp / "bad", bad)
        with self.assertRaises(Exception):
            MOD.release_tag(MOD.load_datasets(root))

    def test_load_order_known_first_then_alphabetical(self):
        self.assertEqual([d.name for d in self.datasets], ["india-repo-rate-dataset", "alpha-test-dataset"])

    def test_real_repo(self):
        datasets = MOD.load_datasets(ROOT / "hf")
        self.assertEqual(len(datasets), 8)
        self.assertEqual([d.name for d in datasets], MOD.ORDER)
        self.assertRegex(MOD.release_tag(datasets), MOD.TAG_PATTERN)
        for ds in datasets:
            self.assertEqual(MOD.zip_name(ds), f"{ds.name}-v{ds.version}.zip")

    # 5. notes
    def test_notes_exact(self):
        expected = (
            "Policy-rate datasets, data through 2026-10-07. One zip per dataset, built from the same verified releases as the site.\n"
            "\n"
            "| Dataset | Version | Data through | Rows in `rates` | Download | Hugging Face |\n"
            "| --- | --- | --- | --- | --- | --- |\n"
            "| `india-repo-rate-dataset` | 2.0.0 | 2026-10-04 | 91 | [zip](https://github.com/o/r/releases/download/datasets-2026-10-07/india-repo-rate-dataset-v2.0.0.zip) | [Hub](https://huggingface.co/datasets/owner/india-repo-rate-dataset) |\n"
            "| `alpha-test-dataset` | 1.2.0 | 2026-10-07 | 1234 | [zip](https://github.com/o/r/releases/download/datasets-2026-10-07/alpha-test-dataset-v1.2.0.zip) | [Hub](https://huggingface.co/datasets/owner/alpha-test-dataset) |\n"
            "\n"
            f"Source release hashes: IN `{'a' * 12}`, US `{'b' * 12}`. Full hashes are in each `provenance/build-manifest.json`.\n"
            "\n"
            "Verify with `sha256sum -c --ignore-missing SHA256SUMS`. On macOS, download every zip and run `shasum -a 256 -c SHA256SUMS`.\n"
        )
        notes = MOD.render_notes(self.datasets, "datasets-2026-10-07", REPO)
        self.assertEqual(notes, expected)
        self.assertIn("SHA256SUMS", notes)
        self.assertEqual(sum(1 for l in notes.splitlines() if l.startswith("| `")), len(self.datasets))
        for mark in DASHES:
            self.assertNotIn(mark, notes)

    def test_title(self):
        self.assertEqual(MOD.release_title("datasets-2026-10-07"), "Datasets 2026-10-07")

    # 6. plan
    def plan(self, tags, sums=None, assets=None, tag="datasets-2026-10-07", new_sums="new\n", new_names=("a.zip", "SHA256SUMS")):
        stub = StubGh(tags=tags, sums=sums, assets=assets)
        return MOD.make_plan(stub, REPO, tag, new_sums, set(new_names))

    def test_plan_first_run_creates(self):
        p = self.plan([])
        self.assertEqual((p.action, p.latest, p.stale), ("create", None, ()))

    def test_plan_identical_skips(self):
        p = self.plan(["datasets-2026-10-07"], sums={"datasets-2026-10-07": "new\n"})
        self.assertEqual(p.action, "skip")

    def test_plan_same_tag_changed_replaces_and_lists_stale(self):
        t = "datasets-2026-10-07"
        p = self.plan([t], sums={t: "old\n"}, assets={t: ["a.zip", "gone.zip", "SHA256SUMS"]})
        self.assertEqual(p.action, "replace")
        self.assertEqual(p.stale, ("gone.zip",))

    def test_plan_newer_tag_creates(self):
        p = self.plan(["datasets-2026-10-01"], sums={"datasets-2026-10-01": "old\n"})
        self.assertEqual((p.action, p.latest), ("create", "datasets-2026-10-01"))

    def test_plan_older_tag_skips(self):
        p = self.plan(["datasets-2026-10-09"], sums={"datasets-2026-10-09": "old\n"})
        self.assertEqual(p.action, "skip")

    def test_plan_ignores_other_tags(self):
        self.assertEqual(MOD.list_release_tags(StubGh(tags=["v1.0.0", "dataset-v1.0.0", "datasets-latest", "datasets-2026-10-02", "datasets-2026-10-01"]), REPO), ["datasets-2026-10-01", "datasets-2026-10-02"])
        p = self.plan(["v1.0.0", "dataset-v1.0.0", "datasets-latest"])
        self.assertEqual((p.action, p.latest), ("create", None))

    def test_plan_latest_without_sums(self):
        t = "datasets-2026-10-07"
        self.assertEqual(self.plan([t]).action, "replace")
        self.assertEqual(self.plan(["datasets-2026-10-01"]).action, "create")

    # 7. main
    def test_dry_run_makes_no_writes(self):
        stub = StubGh()
        code, out, err = self.run_main(stub, "--dry-run")
        self.assertEqual(code, 0)
        self.assertEqual(stub.writes(), [])
        report = json.loads(out)
        self.assertTrue(report["dry_run"])
        self.assertEqual((report["tag"], report["action"]), ("datasets-2026-10-07", "create"))
        self.assertEqual(len(report["assets"]), len(self.datasets) + 1)
        self.assertIn("Policy-rate datasets", err)

    def test_dry_run_with_unreadable_state(self):
        stub = StubGh(list_error="gh: not logged in")
        code, out, _ = self.run_main(stub, "--dry-run")
        self.assertEqual(code, 0)
        report = json.loads(out)
        self.assertEqual((report["action"], report["reason"]), ("create", "release state unknown"))
        self.assertEqual(stub.writes(), [])

    def test_create_order(self):
        stub = StubGh()
        code, out, _ = self.run_main(stub, "--target", "abc123")
        self.assertEqual(code, 0)
        writes = stub.writes()
        self.assertEqual([w[:2] for w in writes], [["release", "create"], ["release", "upload"]])
        create, upload = writes
        self.assertEqual(create[2], "datasets-2026-10-07")
        self.assertEqual(sum(1 for a in create if a.endswith(".zip")), len(self.datasets))
        for flag, value in (("--notes-file", None), ("--title", "Datasets 2026-10-07"), ("--target", "abc123"), ("--repo", REPO)):
            self.assertIn(flag, create)
            if value:
                self.assertEqual(create[create.index(flag) + 1], value)
        self.assertIn("--latest=false", create)
        self.assertTrue(upload[3].endswith("SHA256SUMS"))
        self.assertNotIn("--clobber", upload)
        self.assertEqual(json.loads(out)["action"], "create")

    def test_replace_order(self):
        t = "datasets-2026-10-07"
        stub = StubGh(tags=[t], sums={t: "old\n"}, assets={t: ["stale.zip", "SHA256SUMS"]})
        code, out, _ = self.run_main(stub)
        self.assertEqual(code, 0)
        writes = stub.writes()
        self.assertEqual([w[:2] for w in writes], [["release", "upload"], ["release", "delete-asset"], ["release", "edit"], ["release", "upload"]])
        self.assertIn("--clobber", writes[0])
        self.assertEqual(sum(1 for a in writes[0] if a.endswith(".zip")), len(self.datasets))
        self.assertEqual(writes[1][2:4], [t, "stale.zip"])
        self.assertIn("--yes", writes[1])
        self.assertIn("--latest=false", writes[2])
        self.assertIn("--notes-file", writes[2])
        self.assertTrue(writes[3][3].endswith("SHA256SUMS"))
        self.assertIn("--clobber", writes[3])
        self.assertEqual(json.loads(out)["remove"], ["stale.zip"])

    def test_skip_writes_nothing(self):
        first = StubGh()
        self.run_main(first)
        sums = (self.tmp / "main-out" / "SHA256SUMS").read_text(encoding="utf-8")
        stub = StubGh(tags=["datasets-2026-10-07"], sums={"datasets-2026-10-07": sums})
        code, out, _ = self.run_main(stub, out_name="second-out")
        self.assertEqual(code, 0)
        self.assertEqual(stub.writes(), [])
        self.assertEqual(json.loads(out)["action"], "skip")

    def test_create_race_replans_as_replace(self):
        stub = StubGh(create_error="a release with the same tag name already exists")
        code, out, _ = self.run_main(stub)
        self.assertEqual(code, 0)
        self.assertEqual([w[:2] for w in stub.writes()], [["release", "create"], ["release", "upload"], ["release", "edit"], ["release", "upload"]])
        self.assertEqual(json.loads(out)["action"], "replace")

    def test_gh_failure_returns_one(self):
        stub = StubGh(fail_on=["release", "create"])
        code, _, err = self.run_main(stub)
        self.assertEqual(code, 1)
        self.assertIn("::error::", err)

    # 8. hygiene
    def test_no_dashes(self):
        for path in (SCRIPT, Path(__file__), ROOT / ".github" / "workflows" / "hf-publish.yml", ROOT / ".github" / "workflows" / "refresh.yml"):
            text = path.read_text(encoding="utf-8")
            for mark in DASHES:
                self.assertNotIn(mark, text, path.name)


if __name__ == "__main__":
    unittest.main()
