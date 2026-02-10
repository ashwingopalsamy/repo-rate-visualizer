"""Regression tests for the generated Hugging Face dataset artifact."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.parse import urlparse

import pyarrow.parquet as pq
import yaml
from datasets import load_dataset


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "build-hf-dataset.py"


def load_builder_module():
    spec = importlib.util.spec_from_file_location("build_hf_dataset", SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load {SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


BUILDER = load_builder_module()


class HuggingFaceDatasetArtifactTest(unittest.TestCase):
    maxDiff = None

    def copy_static_files(self, output_dir: Path) -> None:
        output_dir.mkdir(parents=True, exist_ok=True)
        for name in ("README.md", "NOTICE.md", "VERSION", "CHANGELOG.md"):
            shutil.copy2(ROOT / "hf-dataset" / name, output_dir / name)

    def build_twice(self) -> tuple[Path, Path, dict, dict]:
        temp_root = Path(self.temp_dir.name)
        first = temp_root / "first"
        second = temp_root / "second"
        self.copy_static_files(first)
        self.copy_static_files(second)
        first_manifest = BUILDER.build_dataset(ROOT / "src" / "data" / "snapshot.json", first)
        second_manifest = BUILDER.build_dataset(ROOT / "src" / "data" / "snapshot.json", second)
        return first, second, first_manifest, second_manifest

    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory(prefix="rbi-hf-dataset-")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_build_is_byte_deterministic_and_manifest_is_reproducible(self) -> None:
        first, second, first_manifest, second_manifest = self.build_twice()
        self.assertEqual(first_manifest, second_manifest)
        first_files = sorted(path.relative_to(first) for path in first.rglob("*") if path.is_file())
        second_files = sorted(path.relative_to(second) for path in second.rglob("*") if path.is_file())
        self.assertEqual(first_files, second_files)
        for relative_path in first_files:
            self.assertEqual(
                (first / relative_path).read_bytes(),
                (second / relative_path).read_bytes(),
                str(relative_path),
            )

    def test_frontmatter_has_exactly_five_parquet_configurations(self) -> None:
        text = (ROOT / "hf-dataset" / "README.md").read_text(encoding="utf-8")
        self.assertTrue(text.startswith("---\n"))
        end = text.find("\n---\n", 4)
        self.assertGreater(end, 0)
        frontmatter = yaml.safe_load(text[4:end])
        self.assertEqual(frontmatter["language"], "en")
        self.assertEqual(
            frontmatter["pretty_name"],
            "India RBI Policy Repo Rate and Monetary Policy Decision History",
        )
        self.assertEqual(frontmatter["tags"], BUILDER.EXPECTED_TAGS)
        self.assertEqual(frontmatter["size_categories"], ["n<1K"])
        self.assertNotIn("license", frontmatter)
        self.assertNotIn("license_name", frontmatter)
        self.assertNotIn("license_link", frontmatter)
        configurations = frontmatter["configs"]
        self.assertEqual(
            [config["config_name"] for config in configurations],
            list(BUILDER.CONFIG_NAMES),
        )
        self.assertTrue(configurations[0]["default"])
        self.assertFalse(any(config.get("default") for config in configurations[1:]))
        for config_name, config in zip(BUILDER.CONFIG_NAMES, configurations):
            self.assertEqual(
                config["data_files"],
                [{"split": "full", "path": f"data/{config_name}.parquet"}],
            )
        self.assertNotRegex(text, r"(?m)^\s+path:\s+exports/")
        self.assertNotIn("rate_series", text)
        self.assertNotIn("<user-or-org>", text)
        self.assertIn("ashwingopalsamy/india-repo-rate-dataset", text)
        self.assertIn("## Attribution & Usage", text)
        self.assertIn("This notice is not a dataset license", text)

    def test_schema_provenance_nulls_and_annual_semantics(self) -> None:
        first, _, manifest, _ = self.build_twice()
        snapshot = json.loads((ROOT / "src" / "data" / "snapshot.json").read_text(encoding="utf-8"))
        first_year = int(snapshot["decisions"][0]["date"][:4])
        latest_year = int(snapshot["decisions"][-1]["date"][:4])
        self.assertEqual(
            manifest["record_counts_by_config"],
            {
                "decisions": len(snapshot["decisions"]),
                "annual": latest_year - first_year + 1,
                "sources": len(snapshot["sources"]),
                "events": len(snapshot["events"]),
                "regimes": len(snapshot["regimes"]),
            },
        )
        self.assertEqual(manifest["rights"], BUILDER.RIGHTS_METADATA)
        decisions = pq.read_table(first / "data/decisions.parquet").to_pylist()
        annual = pq.read_table(first / "data/annual.parquet").to_pylist()
        sources = pq.read_table(first / "data/sources.parquet").to_pylist()
        self.assertEqual(len(decisions), manifest["record_counts_by_config"]["decisions"])
        self.assertEqual(decisions[0]["canonical_key"], "IN:RBI:policy_repo_rate:2000-06-05")
        self.assertIsNone(decisions[0]["decision_date"])
        self.assertEqual(decisions[0]["provenance_class"], "legacy_import")
        self.assertEqual(decisions[0]["verification_status"], "historical_legacy_source")
        self.assertEqual(decisions[0]["policy_rate_bps"], 905)
        self.assertEqual(decisions[1]["previous_policy_rate_bps"], 905)
        self.assertEqual(decisions[1]["change_bps"], -5)
        self.assertEqual(decisions[1]["action"], "cut")

        official = next(row for row in decisions if row["effective_date"].isoformat() == "2026-08-05")
        self.assertEqual(official["record_type"], "policy_decision")
        self.assertEqual(official["decision_date"], official["effective_date"])
        self.assertEqual(official["stance"], "neutral")
        self.assertEqual(official["provenance_class"], "official_primary")
        self.assertEqual(official["verification_status"], "verified_primary_source")
        self.assertEqual(official["policy_rate_bps"], 525)
        self.assertEqual(official["action"], "hold")
        self.assertFalse(official["is_rate_change"])
        self.assertLess(len(official["decision_summary"]), 250)
        self.assertLess(len(official["record_text"]), 350)
        self.assertGreater(sum(row["action"] == "hold" for row in decisions), 0)

        year_2000 = annual[0]
        self.assertIsNone(year_2000["start_policy_rate_pct"])
        self.assertIsNone(year_2000["net_change_bps"])
        self.assertEqual(year_2000["end_policy_rate_pct"], 10.0)
        year_2021 = next(row for row in annual if row["year"] == 2021)
        self.assertEqual(year_2021["decision_count"], 0)
        self.assertEqual(year_2021["policy_decision_count"], 0)
        self.assertEqual(year_2021["historical_observation_count"], 0)
        self.assertEqual(year_2021["start_policy_rate_pct"], 4.0)
        self.assertEqual(year_2021["end_policy_rate_pct"], 4.0)
        self.assertEqual(year_2021["year_end_source_id"], "source-reuters-historical-2025")
        self.assertIsNone(year_2021["year_end_action"])
        self.assertIsNone(year_2021["year_end_stance"])

        self.assertEqual(len(sources), manifest["record_counts_by_config"]["sources"])
        self.assertEqual(
            {row["provenance_class"] for row in sources},
            {"official_primary", "official_secondary", "legacy_import"},
        )
        dictionary = json.loads((first / "schema/data-dictionary.json").read_text(encoding="utf-8"))
        self.assertEqual(dictionary["rights"], BUILDER.RIGHTS_METADATA)
        source_ids = {row["source_id"] for row in sources}
        for row in decisions:
            self.assertTrue(set(row["source_ids"]).issubset(source_ids))
            for value in row.values():
                if isinstance(value, str):
                    self.assertNotEqual(value, "")

    def test_explicit_arrow_schema_and_huggingface_local_loading(self) -> None:
        first, _, _, _ = self.build_twice()
        for config_name in BUILDER.CONFIG_NAMES:
            parquet_path = first / f"data/{config_name}.parquet"
            table = pq.read_table(parquet_path)
            expected = BUILDER.arrow_schema(config_name)
            self.assertEqual(table.schema.names, expected.names)
            for actual, expected_field in zip(table.schema, expected):
                self.assertEqual(actual.type, expected_field.type, config_name)
                self.assertEqual(actual.nullable, expected_field.nullable, config_name)
            dataset = load_dataset(
                "parquet",
                data_files={"full": str(parquet_path)},
                split="full",
                keep_in_memory=True,
            )
            self.assertEqual(len(dataset), table.num_rows)
            self.assertEqual(dataset.column_names, expected.names)

    def test_checksums_cover_every_artifact_except_sha256sums(self) -> None:
        first, _, manifest, _ = self.build_twice()
        checksum_path = first / "SHA256SUMS"
        lines = checksum_path.read_text(encoding="utf-8").splitlines()
        expected_files = sorted(
            path.relative_to(first).as_posix()
            for path in first.rglob("*")
            if path.is_file() and path.name != "SHA256SUMS"
        )
        listed_files = [line.split("  ", 1)[1] for line in lines]
        self.assertEqual(listed_files, expected_files)
        for line in lines:
            digest, relative = line.split("  ", 1)
            actual = hashlib.sha256((first / relative).read_bytes()).hexdigest()
            self.assertEqual(digest, actual, relative)
        manifest_files = sorted(manifest["output_checksums"])
        self.assertEqual(
            manifest_files,
            [path for path in expected_files if path not in {"provenance/build-manifest.json", "SHA256SUMS"}],
        )

    def test_artifact_layout_is_exact_and_notice_is_standalone(self) -> None:
        first, _, _, _ = self.build_twice()
        actual_files = {
            path.relative_to(first).as_posix()
            for path in first.rglob("*")
            if path.is_file()
        }
        self.assertEqual(actual_files, BUILDER.EXPECTED_ARTIFACT_PATHS)
        notice = (first / "NOTICE.md").read_text(encoding="utf-8")
        self.assertIn("publicly available records", notice)
        self.assertIn("This notice is not a dataset license", notice)

    def test_urls_and_generated_ids_are_machine_resolvable(self) -> None:
        first, _, _, _ = self.build_twice()
        decisions = pq.read_table(first / "data/decisions.parquet").to_pylist()
        sources = pq.read_table(first / "data/sources.parquet").to_pylist()
        events = pq.read_table(first / "data/events.parquet").to_pylist()
        self.assertEqual(len({row["decision_id"] for row in decisions}), len(decisions))
        self.assertEqual(len({row["canonical_key"] for row in decisions}), len(decisions))
        for row in sources:
            parsed = urlparse(row["url"])
            self.assertIn(parsed.scheme, {"http", "https"})
            self.assertTrue(parsed.netloc)
        for row in events:
            parsed = urlparse(row["citation_url"])
            self.assertIn(parsed.scheme, {"http", "https"})
            self.assertTrue(parsed.netloc)


if __name__ == "__main__":
    unittest.main()
