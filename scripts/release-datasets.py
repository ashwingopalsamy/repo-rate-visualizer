#!/usr/bin/env python3
"""Publish the built datasets under hf/ as one GitHub release.

Each folder under hf/ becomes a reproducible zip (sorted entries, fixed timestamps and modes), so identical input gives
identical bytes. The release tag is datasets-<newest generated_at>. The release is skipped when the newest datasets-*
release already has the same SHA256SUMS, and its assets are replaced when the same tag has different content. Releases
are created with --latest=false, so the site's own releases keep the Latest badge. Needs the gh CLI signed in with write
access (in CI, GH_TOKEN); --dry-run only reads and changes nothing.

Usage: python scripts/release-datasets.py [--dry-run] [--repo OWNER/NAME] [--target SHA] [--out DIR]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import zipfile
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HF = ROOT / "hf"
DEFAULT_REPO = "ashwingopalsamy/repo-rate-visualizer"
TAG_PREFIX = "datasets-"
TAG_PATTERN = re.compile(r"^datasets-\d{4}-\d{2}-\d{2}$")
SUMS_NAME = "SHA256SUMS"
NOTES_NAME = "RELEASE_NOTES.md"
ORDER = [
    "central-bank-policy-rates",
    "india-repo-rate-dataset",
    "us-fed-funds-rate-dataset",
    "euro-area-deposit-facility-rate-dataset",
    "uk-bank-rate-dataset",
    "canada-overnight-rate-dataset",
    "australia-cash-rate-dataset",
    "brazil-selic-rate-dataset",
]
ZIP_TIME = (1980, 1, 1, 0, 0, 0)
ZIP_MODE = 0o100644 << 16
COMPRESSION, LEVEL = zipfile.ZIP_DEFLATED, 9
IGNORED = {".DS_Store"}
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class GhError(RuntimeError):
    pass


@dataclass(frozen=True)
class Dataset:
    folder: Path
    name: str
    repo_id: str
    version: str
    generated_at: str
    data_through: str
    rates_rows: int
    releases: tuple[tuple[str, str], ...]


@dataclass(frozen=True)
class Asset:
    name: str
    path: Path
    sha256: str
    size: int


@dataclass(frozen=True)
class Plan:
    action: str  # "skip" | "create" | "replace"
    tag: str
    reason: str
    latest: str | None
    stale: tuple[str, ...] = ()


# Takes the gh arguments (everything after "gh").
Runner = Callable[[Sequence[str]], "subprocess.CompletedProcess[str]"]


def gh_run(args: Sequence[str]) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(["gh", *args], capture_output=True, text=True, check=False)
    except FileNotFoundError:
        return subprocess.CompletedProcess(["gh", *args], 127, "", "gh is not installed")


def load_datasets(hf_root: Path = HF) -> list[Dataset]:
    datasets = []
    for folder in sorted(hf_root.iterdir()):
        path = folder / "provenance" / "build-manifest.json"
        if not path.is_file():
            continue
        m = json.loads(path.read_text(encoding="utf-8"))
        name = m["repo_id"].split("/")[1]
        if folder.name != name:
            raise ValueError(f"{folder} does not match its manifest repo_id {m['repo_id']}")
        datasets.append(Dataset(
            folder=folder,
            name=name,
            repo_id=m["repo_id"],
            version=m["version"],
            generated_at=m["generated_at"],
            data_through=(m.get("coverage") or {}).get("daily_to") or m["generated_at"],
            rates_rows=int(m["record_counts_by_config"]["rates"]),
            releases=tuple((r["country_code"], r["hash"]) for r in m["releases"]),
        ))
    rank = {n: i for i, n in enumerate(ORDER)}
    return sorted(datasets, key=lambda d: (rank.get(d.name, len(ORDER)), d.name))


def release_tag(datasets: Sequence[Dataset]) -> str:
    newest = max(d.generated_at for d in datasets)
    if not DATE.match(newest):
        raise ValueError(f"generated_at must be YYYY-MM-DD, got {newest!r}")
    return TAG_PREFIX + newest


def zip_name(ds: Dataset) -> str:
    return f"{ds.name}-v{ds.version}.zip"


def dataset_files(folder: Path) -> list[Path]:
    files = [p for p in folder.rglob("*") if p.is_file() and p.name not in IGNORED]
    return sorted(files, key=lambda p: p.relative_to(folder).as_posix())


def build_zip(folder: Path, dest: Path) -> str:
    with zipfile.ZipFile(dest, "w", COMPRESSION, compresslevel=LEVEL) as zf:
        for path in dataset_files(folder):
            info = zipfile.ZipInfo(f"{folder.name}/{path.relative_to(folder).as_posix()}", date_time=ZIP_TIME)
            info.compress_type = COMPRESSION
            info.external_attr = ZIP_MODE
            info.create_system = 3
            info.extra = b""
            zf.writestr(info, path.read_bytes(), compress_type=COMPRESSION, compresslevel=LEVEL)
    return hashlib.sha256(dest.read_bytes()).hexdigest()


def build_assets(datasets: Sequence[Dataset], out_dir: Path) -> list[Asset]:
    assets = []
    for ds in datasets:
        dest = out_dir / zip_name(ds)
        digest = build_zip(ds.folder, dest)
        assets.append(Asset(dest.name, dest, digest, dest.stat().st_size))
    return sorted(assets, key=lambda a: a.name)


def render_sums(assets: Sequence[Asset]) -> str:
    return "".join(f"{a.sha256}  {a.name}\n" for a in sorted(assets, key=lambda a: a.name))


def release_title(tag: str) -> str:
    return "Datasets " + tag[len(TAG_PREFIX):]


def render_notes(datasets: Sequence[Dataset], tag: str, repo: str) -> str:
    rows = "\n".join(
        f"| `{d.name}` | {d.version} | {d.data_through} | {d.rates_rows} "
        f"| [zip](https://github.com/{repo}/releases/download/{tag}/{zip_name(d)}) "
        f"| [Hub](https://huggingface.co/datasets/{d.repo_id}) |"
        for d in datasets
    )
    seen: dict[tuple[str, str], None] = {}
    for d in datasets:
        for release in d.releases:
            seen.setdefault(release)
    hashes = ", ".join(f"{cc} `{h[:12]}`" for cc, h in seen)
    return (
        f"Policy-rate datasets, data through {max(d.data_through for d in datasets)}. "
        "One zip per dataset, built from the same verified releases as the site.\n"
        "\n"
        "| Dataset | Version | Data through | Rows in `rates` | Download | Hugging Face |\n"
        "| --- | --- | --- | --- | --- | --- |\n"
        f"{rows}\n"
        "\n"
        f"Source release hashes: {hashes}. Full hashes are in each `provenance/build-manifest.json`.\n"
        "\n"
        f"Verify with `sha256sum -c --ignore-missing {SUMS_NAME}`. "
        f"On macOS, download every zip and run `shasum -a 256 -c {SUMS_NAME}`.\n"
    )


def read_json(run: Runner, args: Sequence[str]):
    result = run(args)
    if result.returncode != 0:
        raise GhError(f"gh {' '.join(args[:2])} failed: {result.stderr.strip() or result.returncode}")
    return json.loads(result.stdout)


def list_release_tags(run: Runner, repo: str) -> list[str]:
    rows = read_json(run, ["release", "list", "--repo", repo, "--json", "tagName", "--limit", "100"])
    return sorted(r["tagName"] for r in rows if TAG_PATTERN.match(r["tagName"]))


def release_asset_names(run: Runner, repo: str, tag: str) -> set[str]:
    data = read_json(run, ["release", "view", tag, "--repo", repo, "--json", "assets"])
    return {a["name"] for a in data["assets"]}


def fetch_sums(run: Runner, repo: str, tag: str) -> str | None:
    result = run(["release", "download", tag, "--repo", repo, "--pattern", SUMS_NAME, "--output", "-"])
    return result.stdout if result.returncode == 0 else None


def make_plan(run: Runner, repo: str, tag: str, sums_text: str, new_names: set[str]) -> Plan:
    tags = list_release_tags(run, repo)
    latest = tags[-1] if tags else None
    if latest and fetch_sums(run, repo, latest) == sums_text:
        return Plan("skip", tag, f"identical to {latest}", latest)
    if latest and tag < latest:
        return Plan("skip", tag, f"newer release {latest} exists", latest)
    if tag in tags:
        stale = tuple(sorted(release_asset_names(run, repo, tag) - new_names))
        return Plan("replace", tag, f"content of {tag} changed", latest, stale)
    return Plan("create", tag, "new release", latest)


def write(run: Runner, args: Sequence[str]) -> None:
    result = run(args)
    if result.returncode != 0:
        raise GhError(f"gh {' '.join(args[:2])} failed: {result.stderr.strip() or result.returncode}")


def apply_plan(run: Runner, plan: Plan, repo: str, assets: Sequence[Asset], sums_path: Path, notes_path: Path, title: str, target: str | None) -> None:
    """SHA256SUMS is always uploaded last, so it marks a complete release."""
    zips = [str(a.path) for a in assets]
    tag = plan.tag
    if plan.action == "create":
        args = ["release", "create", tag, *zips, "--repo", repo, "--title", title, "--notes-file", str(notes_path), "--latest=false"]
        if target:
            args += ["--target", target]
        write(run, args)
        write(run, ["release", "upload", tag, str(sums_path), "--repo", repo])
    elif plan.action == "replace":
        write(run, ["release", "upload", tag, *zips, "--clobber", "--repo", repo])
        for name in plan.stale:
            write(run, ["release", "delete-asset", tag, name, "--yes", "--repo", repo])
        write(run, ["release", "edit", tag, "--repo", repo, "--title", title, "--notes-file", str(notes_path), "--latest=false"])
        write(run, ["release", "upload", tag, str(sums_path), "--clobber", "--repo", repo])


def release(args: argparse.Namespace, out_dir: Path, run: Runner, hf_root: Path) -> int:
    datasets = load_datasets(hf_root)
    tag = release_tag(datasets)
    out_dir.mkdir(parents=True, exist_ok=True)
    assets = build_assets(datasets, out_dir)
    sums_text = render_sums(assets)
    sums_path = out_dir / SUMS_NAME
    sums_path.write_text(sums_text, encoding="utf-8")
    notes = render_notes(datasets, tag, args.repo)
    notes_path = out_dir / NOTES_NAME
    notes_path.write_text(notes, encoding="utf-8")
    title = release_title(tag)
    new_names = {a.name for a in assets} | {SUMS_NAME}

    def plan_release() -> Plan:
        return make_plan(run, args.repo, tag, sums_text, new_names)

    if args.dry_run:
        try:
            plan = plan_release()
        except GhError:
            plan = Plan("create", tag, "release state unknown", None)
        print(notes, file=sys.stderr)
    else:
        plan = plan_release()
        if plan.action != "skip":
            try:
                apply_plan(run, plan, args.repo, assets, sums_path, notes_path, title, args.target)
            except GhError:
                # Another run may have created the tag first; take the replace path once.
                if plan.action != "create" or tag not in list_release_tags(run, args.repo):
                    raise
                plan = plan_release()
                if plan.action != "skip":
                    apply_plan(run, plan, args.repo, assets, sums_path, notes_path, title, args.target)

    listed = [{"name": a.name, "size": a.size, "sha256": a.sha256} for a in assets]
    listed.append({"name": SUMS_NAME, "size": sums_path.stat().st_size, "sha256": hashlib.sha256(sums_text.encode("utf-8")).hexdigest()})
    report = {
        "dry_run": args.dry_run,
        "tag": tag,
        "action": plan.action,
        "reason": plan.reason,
        "latest": plan.latest,
        "assets": listed,
        "remove": list(plan.stale),
    }
    print(json.dumps(report, indent=2))
    return 0


def main(argv: Sequence[str] | None = None, run: Runner = gh_run, hf_root: Path = HF) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true", help="report what would change without touching GitHub")
    ap.add_argument("--repo", default=DEFAULT_REPO, help="OWNER/NAME of the GitHub repository")
    ap.add_argument("--target", help="commit SHA for a newly created tag")
    ap.add_argument("--out", help="directory for the built zips (default: a temporary directory)")
    args = ap.parse_args(argv)
    try:
        if args.out:
            return release(args, Path(args.out), run, hf_root)
        with tempfile.TemporaryDirectory(prefix="release-datasets-") as tmp:
            return release(args, Path(tmp), run, hf_root)
    except (GhError, ValueError, KeyError, OSError) as e:
        print(f"::error::{e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
