"""Regression tests for the Hugging Face dataset folders built from the TypeScript bundle."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

import pyarrow.compute as pc
import pyarrow.parquet as pq
import yaml
from datasets import load_dataset


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "build-hf-datasets.py"
MULTI = "central-bank-policy-rates"


def load_builder_module():
    spec = importlib.util.spec_from_file_location("build_hf_datasets", SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load {SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


BUILDER = load_builder_module()


def repo_changelog_or_stub(directory: Path, version: str) -> str:
    """Prefer the checked-in changelog; fall back to a stub when it is absent or predates the bundle version."""
    path = ROOT / directory / "CHANGELOG.md"
    if path.is_file():
        text = path.read_text(encoding="utf-8")
        heading = next((line for line in text.splitlines() if line.startswith("## ")), "")
        if heading[3:].startswith(version):
            return text
    return f"# Changelog\n\n## {version} — test\n"


class HuggingFaceDatasetsTest(unittest.TestCase):
    maxDiff = None

    @classmethod
    def setUpClass(cls) -> None:
        cls.tmp = tempfile.TemporaryDirectory(prefix="hf-datasets-")
        cls.addClassCleanup(cls.tmp.cleanup)
        tmp = Path(cls.tmp.name)
        bundle_path = tmp / "bundle.json"
        subprocess.run(["node", "scripts/build-hf-tables.ts", "--out", str(bundle_path)], cwd=ROOT, check=True, capture_output=True)
        cls.bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
        cls.datasets = {Path(d["dir"]).name: d for d in cls.bundle["datasets"]}
        cls.roots = (tmp / "first", tmp / "second")
        for root in cls.roots:
            for dataset in cls.bundle["datasets"]:
                directory = root / dataset["dir"]
                directory.mkdir(parents=True)
                (directory / "CHANGELOG.md").write_text(repo_changelog_or_stub(Path(dataset["dir"]), dataset["version"]), encoding="utf-8")
            BUILDER.build(bundle_path, root)
        cls.cache: dict[tuple[str, str], object] = {}

    # helpers

    def directory(self, name: str, which: int = 0) -> Path:
        return self.roots[which] / self.datasets[name]["dir"]

    def table(self, name: str, config: str):
        key = (name, config)
        if key not in self.cache:
            self.cache[key] = pq.read_table(self.directory(name) / "data" / f"{config}.parquet")
        return self.cache[key]

    def rows(self, name: str, config: str) -> list[dict]:
        return self.table(name, config).to_pylist()

    def config_names(self, name: str) -> list[str]:
        return [c["name"] for c in self.datasets[name]["configs"]]

    def per_country(self) -> list[str]:
        return [name for name in self.datasets if name != MULTI]

    def country(self, name: str) -> str:
        return self.datasets[name]["country_codes"][0]

    # reproducibility and integrity

    def test_builds_are_byte_identical(self) -> None:
        for name, dataset in self.datasets.items():
            first, second = self.directory(name, 0), self.directory(name, 1)
            files = BUILDER.relative_files(first)
            self.assertEqual(files, BUILDER.relative_files(second), name)
            for rel in files:
                self.assertEqual((first / rel).read_bytes(), (second / rel).read_bytes(), f"{name}/{rel}")

    def test_sha256sums_and_manifest_cover_every_file(self) -> None:
        for name in self.datasets:
            directory = self.directory(name)
            files = set(BUILDER.relative_files(directory))
            lines = (directory / "SHA256SUMS").read_text(encoding="utf-8").splitlines()
            listed = {}
            for line in lines:
                digest, rel = line.split("  ", 1)
                listed[rel] = digest
            self.assertEqual([line.split("  ", 1)[1] for line in lines], sorted(listed), f"{name}: SHA256SUMS not sorted")
            self.assertEqual(set(listed), files - {"SHA256SUMS"}, name)
            for rel, digest in listed.items():
                self.assertEqual(hashlib.sha256((directory / rel).read_bytes()).hexdigest(), digest, f"{name}/{rel}")
            manifest = json.loads((directory / "provenance" / "build-manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(set(manifest["output_checksums"]), files - {"SHA256SUMS", "provenance/build-manifest.json"}, name)
            for rel, digest in manifest["output_checksums"].items():
                self.assertEqual(listed[rel], digest, f"{name}/{rel}")
            self.assertEqual(manifest["generated_at"], self.datasets[name]["generated_at"])

    def test_readme_front_matter(self) -> None:
        for name, dataset in self.datasets.items():
            text = (self.directory(name) / "README.md").read_text(encoding="utf-8")
            self.assertTrue(text.startswith("---\n"), name)
            front = yaml.safe_load(text[4 : text.index("\n---\n", 4)])
            configs = front["configs"]
            self.assertEqual([c["config_name"] for c in configs], self.config_names(name), name)
            self.assertEqual([c["config_name"] for c in configs if c.get("default") is True], [dataset["default_config"]], name)
            for entry in configs:
                self.assertEqual(entry["data_files"], [{"split": "full", "path": f"data/{entry['config_name']}.parquet"}], name)
                self.assertFalse(entry["data_files"][0]["path"].startswith("exports/"))
            license_id = dataset["rights"]["dataset_license"]
            if license_id is None:
                self.assertNotIn("license", front, name)
            else:
                self.assertEqual(front["license"], license_id, name)

    # row counts and consistency

    def test_decision_counts(self) -> None:
        self.assertEqual(self.table(MULTI, "decisions").filter(pc.equal(self.table(MULTI, "decisions")["country_code"], "IN")).num_rows, 62)
        self.assertEqual(self.table(MULTI, "decisions").filter(pc.equal(self.table(MULTI, "decisions")["country_code"], "US")).num_rows, 46)
        self.assertEqual(self.table("india-repo-rate-dataset", "decisions").num_rows, 62)
        self.assertEqual(self.table("us-fed-funds-rate-dataset", "decisions").num_rows, 46)

    def test_rates_rows_match_release_series(self) -> None:
        manifest = json.loads((ROOT / "data" / "manifest.json").read_text(encoding="utf-8"))
        multi = self.table(MULTI, "rates")
        for name in self.per_country():
            code = self.country(name)
            release = json.loads((ROOT / "data" / manifest["countries"][code]["path"]).read_text(encoding="utf-8"))
            self.assertEqual(self.table(name, "rates").num_rows, len(release["series"]), name)
            self.assertEqual(multi.filter(pc.equal(multi["country_code"], code)).num_rows, len(release["series"]), code)

    def test_per_country_tables_equal_filtered_multi_tables(self) -> None:
        for name in self.per_country():
            code = self.country(name)
            present = set(self.config_names(name))
            for config in self.config_names(MULTI):
                multi = self.table(MULTI, config)
                subset = multi.filter(pc.equal(multi["country_code"], code))
                if config in present:
                    single = self.table(name, config)
                    self.assertTrue(single.schema.equals(multi.schema, check_metadata=False), f"{name}/{config} schema")
                    self.assertEqual(single.to_pylist(), subset.to_pylist(), f"{name}/{config} rows")
                else:
                    self.assertEqual(subset.num_rows, 0, f"{code} has rows in multi {config} but {name} omits it")

    def test_daily_is_contiguous_and_agrees_with_rates(self) -> None:
        for name in [MULTI] + self.per_country():
            daily_rows, rate_rows = self.rows(name, "daily"), self.rows(name, "rates")
            codes = {r["country_code"] for r in daily_rows}
            self.assertTrue(codes, name)
            for code in codes:
                daily = [r for r in daily_rows if r["country_code"] == code]
                dates = [r["date"] for r in daily]
                for earlier, later in zip(dates, dates[1:]):
                    self.assertEqual(later - earlier, timedelta(days=1), f"{name}/{code} gap after {earlier}")
                by_date = {r["date"]: r for r in daily}
                rates = {r["effective_date"]: r for r in rate_rows if r["country_code"] == code}
                in_range = {d: r for d, r in rates.items() if dates[0] <= d <= dates[-1]}
                for d, rate in in_range.items():
                    self.assertEqual(by_date[d]["rate_bps"], rate["rate_bps"], f"{name}/{code} {d}")
                self.assertEqual({d for d, r in by_date.items() if r["is_change"]}, set(in_range), f"{name}/{code} is_change")

    def test_range_and_change_invariants(self) -> None:
        for name in [MULTI] + self.per_country():
            for config in ("rates", "decisions", "daily"):
                if config not in self.config_names(name):
                    continue
                for row in self.rows(name, config):
                    label = f"{name}/{config}/{row.get('effective_date') or row.get('date')}"
                    if row["level_kind"] == "range":
                        self.assertLess(row["rate_low_pct"], row["rate_high_pct"], label)
                    self.assertEqual(row["rate_pct"], row["rate_high_pct"], label)
                    if "change_bps" in row:
                        self.assertEqual(row["change_bps"] is None, row["direction"] in ("initial", "era_change"), label)

    def test_spot_checks(self) -> None:
        decisions = {r["decision_id"]: r for r in self.rows(MULTI, "decisions")}
        hold = decisions["IN-2026-08-05"]
        self.assertEqual((hold["direction"], hold["rate_pct"], hold["vote_for"], hold["vote_against"]), ("hold", 5.25, 6, 0))
        hike = decisions["IN-2026-10-07"]
        self.assertEqual((hike["direction"], hike["rate_pct"], hike["change_bps"]), ("hike", 5.5, 25))
        us = [r for r in self.rows(MULTI, "rates") if r["country_code"] == "US" and r["effective_date"] == date(2008, 12, 16)]
        self.assertEqual(len(us), 1)
        self.assertEqual((us[0]["level_kind"], us[0]["direction"]), ("range", "era_change"))
        gb = [r for r in self.rows(MULTI, "daily") if r["country_code"] == "GB" and r["date"] == date(2025, 12, 18)]
        self.assertEqual(len(gb), 1)
        self.assertEqual((gb[0]["rate_pct"], gb[0]["is_change"]), (3.75, True))

    def test_datasets_library_loads_every_multi_config(self) -> None:
        directory = self.directory(MULTI)
        cache = Path(self.tmp.name) / "hf-cache"
        for config in self.datasets[MULTI]["configs"]:
            loaded = load_dataset(
                "parquet",
                data_files={"full": str(directory / "data" / f"{config['name']}.parquet")},
                split="full",
                cache_dir=str(cache),
            )
            self.assertEqual(loaded.num_rows, len(config["rows"]), config["name"])
            self.assertEqual(loaded.column_names, [c["name"] for c in config["columns"]], config["name"])

    # CSV cell formatting

    def test_csv_formula_guard(self) -> None:
        self.assertEqual(BUILDER.csv_cell("=1+1", "string"), "'=1+1")
        self.assertEqual(BUILDER.csv_cell("@sum", "string"), "'@sum")
        self.assertEqual(BUILDER.csv_cell("plain", "string"), "plain")
        self.assertEqual(BUILDER.csv_cell(-25, "int32"), "-25")
        self.assertEqual(BUILDER.csv_cell(None, "int32"), "")
        self.assertEqual(BUILDER.csv_cell(True, "bool"), "true")
        self.assertEqual(BUILDER.csv_cell(["a", "b"], "string_list"), '["a","b"]')


if __name__ == "__main__":
    unittest.main()
