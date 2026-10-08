"""Serialize the HF bundle produced by scripts/build-hf-tables.ts into dataset folders.

All table semantics live in the TypeScript step. This script validates the bundle,
then writes Parquet, CSV, JSONL, schemas, a build manifest and SHA256SUMS
deterministically, and re-validates the resulting layout.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import shutil
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence

import pyarrow as pa
import pyarrow.parquet as pq
import yaml


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BUNDLE = ROOT / ".out" / "hf" / "bundle.json"
BUNDLE_VERSION = 1
GENERATOR = "scripts/build-hf-datasets.py"
GENERATOR_VERSION = "2.0.0"
GENERATED_DIRS = ("data", "exports", "schema", "provenance")
STATIC_FILES = ("README.md", "NOTICE.md")
CONFIG_NAME_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIMESTAMP_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$")
INT32_MIN, INT32_MAX = -(2**31), 2**31 - 1
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")

ARROW_TYPES: dict[str, pa.DataType] = {
    "string": pa.string(),
    "int32": pa.int32(),
    "float64": pa.float64(),
    "bool": pa.bool_(),
    "date": pa.date32(),
    "timestamp": pa.timestamp("us", tz="UTC"),
    "string_list": pa.list_(pa.string()),
}
JSON_TYPES: dict[str, dict[str, Any]] = {
    "string": {"type": "string"},
    "int32": {"type": "integer"},
    "float64": {"type": "number"},
    "bool": {"type": "boolean"},
    "date": {"type": "string", "format": "date"},
    "timestamp": {"type": "string", "format": "date-time"},
    "string_list": {"type": "array", "items": {"type": "string"}},
}


def fail(message: str) -> None:
    raise ValueError(message)


def parse_date(value: str) -> date:
    if not DATE_PATTERN.match(value):
        raise ValueError(value)
    return date.fromisoformat(value)


def parse_timestamp(value: str) -> datetime:
    if not TIMESTAMP_PATTERN.match(value):
        raise ValueError(value)
    return datetime.fromisoformat(value[:-1] + "+00:00").astimezone(timezone.utc)


def check_value(value: Any, type_name: str) -> Any:
    """Return the canonical JSON-side value, or raise ValueError when it does not match the type."""
    if type_name == "string":
        if not isinstance(value, str):
            raise ValueError("expected string")
        return value
    if type_name == "int32":
        if isinstance(value, bool) or not isinstance(value, int) or not INT32_MIN <= value <= INT32_MAX:
            raise ValueError("expected int32")
        return value
    if type_name == "float64":
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError("expected finite number")
        return float(value)
    if type_name == "bool":
        if not isinstance(value, bool):
            raise ValueError("expected bool")
        return value
    if type_name == "date":
        if not isinstance(value, str):
            raise ValueError("expected YYYY-MM-DD string")
        parse_date(value)
        return value
    if type_name == "timestamp":
        if not isinstance(value, str):
            raise ValueError("expected ISO 8601 UTC string")
        parse_timestamp(value)
        return value
    if type_name == "string_list":
        if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
            raise ValueError("expected array of strings")
        return value
    raise ValueError(f"unknown type {type_name}")


def validate_dataset(dataset: Any, index: int) -> dict[str, Any]:
    if not isinstance(dataset, dict):
        fail(f"datasets[{index}] must be an object")
    for key in ("repo_id", "dir", "version", "generated_at", "default_config"):
        if not isinstance(dataset.get(key), str) or not dataset[key]:
            fail(f"datasets[{index}].{key} must be a non-empty string")
    repo_id = dataset["repo_id"]
    where = repo_id
    rel = Path(dataset["dir"])
    if rel.is_absolute() or ".." in rel.parts or len(rel.parts) != 2:
        fail(f"{where}: dir must be a relative two-segment path such as hf/<repo>")
    if not DATE_PATTERN.match(dataset["generated_at"]):
        fail(f"{where}: generated_at must be YYYY-MM-DD")
    for key in ("country_codes", "jsonl_configs", "releases", "configs"):
        if not isinstance(dataset.get(key), list):
            fail(f"{where}: {key} must be an array")
    if not isinstance(dataset.get("rights"), dict):
        fail(f"{where}: rights must be an object")
    files = dataset.get("files")
    if not isinstance(files, dict) or set(files) != set(STATIC_FILES) or not all(isinstance(v, str) for v in files.values()):
        fail(f"{where}: files must contain exactly {', '.join(STATIC_FILES)} as strings")

    seen: set[str] = set()
    for config in dataset["configs"]:
        if not isinstance(config, dict):
            fail(f"{where}: config entries must be objects")
        name = config.get("name")
        if not isinstance(name, str) or not CONFIG_NAME_PATTERN.match(name):
            fail(f"{where}: invalid config name {name!r}")
        if name in seen:
            fail(f"{where}: duplicate config {name}")
        seen.add(name)
        for key in ("description", "grain"):
            if not isinstance(config.get(key), str):
                fail(f"{where}/{name}: {key} must be a string")
        columns = config.get("columns")
        rows = config.get("rows")
        if not isinstance(columns, list) or not columns or not isinstance(rows, list):
            fail(f"{where}/{name}: columns must be a non-empty array and rows an array")
        names: list[str] = []
        for column in columns:
            if (
                not isinstance(column, dict)
                or not isinstance(column.get("name"), str)
                or column.get("type") not in ARROW_TYPES
                or not isinstance(column.get("nullable"), bool)
                or not isinstance(column.get("description"), str)
            ):
                fail(f"{where}/{name}: malformed column {column!r}")
            names.append(column["name"])
        if len(set(names)) != len(names):
            fail(f"{where}/{name}: duplicate column names")
        expected = set(names)
        for position, row in enumerate(rows):
            if not isinstance(row, dict) or set(row) != expected:
                fail(f"{where}/{name}: row {position} keys do not match the declared columns")
            for column in columns:
                value = row[column["name"]]
                if value is None:
                    if not column["nullable"]:
                        fail(f"{where}/{name}: row {position} has null in non-nullable column {column['name']}")
                    continue
                try:
                    check_value(value, column["type"])
                except ValueError as exc:
                    fail(f"{where}/{name}: row {position} column {column['name']}: {exc} (got {value!r})")
    if dataset["default_config"] not in seen:
        fail(f"{where}: default_config {dataset['default_config']} is not a config")
    if not set(dataset["jsonl_configs"]) <= seen:
        fail(f"{where}: jsonl_configs contains unknown configs")
    return dataset


def validate_changelog(directory: Path, dataset: Mapping[str, Any]) -> None:
    changelog = directory / "CHANGELOG.md"
    if not changelog.is_file():
        fail(f"{dataset['repo_id']}: {changelog} must exist before building")
    for line in changelog.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            if not line[3:].startswith(dataset["version"]):
                fail(f"{dataset['repo_id']}: first CHANGELOG heading {line!r} does not start with version {dataset['version']}")
            return
    fail(f"{dataset['repo_id']}: CHANGELOG.md has no '## ' heading")


def csv_cell(value: Any, type_name: str) -> str:
    if value is None:
        return ""
    if type_name == "bool":
        return "true" if value else "false"
    if type_name == "float64":
        return repr(float(value))
    if type_name == "string_list":
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    text = str(value)
    if type_name == "string" and text.startswith(FORMULA_PREFIXES):
        return "'" + text
    return text


def arrow_value(value: Any, type_name: str) -> Any:
    if value is None:
        return None
    if type_name == "date":
        return parse_date(value)
    if type_name == "timestamp":
        return parse_timestamp(value)
    return value


def arrow_schema(dataset: Mapping[str, Any], config: Mapping[str, Any]) -> pa.Schema:
    fields = [
        pa.field(
            column["name"],
            ARROW_TYPES[column["type"]],
            nullable=column["nullable"],
            metadata={"description": column["description"]},
        )
        for column in config["columns"]
    ]
    return pa.schema(
        fields,
        metadata={
            "repo_id": dataset["repo_id"],
            "version": dataset["version"],
            "config": config["name"],
            "generated_at": dataset["generated_at"],
        },
    )


def write_parquet(path: Path, dataset: Mapping[str, Any], config: Mapping[str, Any]) -> None:
    schema = arrow_schema(dataset, config)
    rows = config["rows"]
    arrays = [
        pa.array([arrow_value(row[column["name"]], column["type"]) for row in rows], type=schema.field(i).type)
        for i, column in enumerate(config["columns"])
    ]
    table = pa.Table.from_arrays(arrays, schema=schema)
    pq.write_table(
        table,
        path,
        compression="zstd",
        compression_level=3,
        use_dictionary=False,
        write_statistics=True,
        version="2.6",
        data_page_version="1.0",
        row_group_size=max(1, len(rows)),
    )


def write_csv(path: Path, config: Mapping[str, Any]) -> None:
    columns = config["columns"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow([column["name"] for column in columns])
        for row in config["rows"]:
            writer.writerow([csv_cell(row[column["name"]], column["type"]) for column in columns])


def write_jsonl(path: Path, config: Mapping[str, Any]) -> None:
    names = [column["name"] for column in config["columns"]]
    types = {column["name"]: column["type"] for column in config["columns"]}
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for row in config["rows"]:
            ordered = {n: (None if row[n] is None else check_value(row[n], types[n])) for n in names}
            handle.write(json.dumps(ordered, ensure_ascii=False, separators=(",", ":")) + "\n")


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def json_schema(dataset: Mapping[str, Any], config: Mapping[str, Any]) -> dict[str, Any]:
    properties: dict[str, Any] = {}
    for column in config["columns"]:
        spec = json.loads(json.dumps(JSON_TYPES[column["type"]]))
        if column["nullable"]:
            spec["type"] = [spec["type"], "null"]
        spec["description"] = column["description"]
        properties[column["name"]] = spec
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": f"{dataset['repo_id']} / {config['name']}",
        "description": config["description"],
        "type": "object",
        "additionalProperties": False,
        "properties": properties,
        "required": [column["name"] for column in config["columns"]],
    }


def data_dictionary(dataset: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "repo_id": dataset["repo_id"],
        "version": dataset["version"],
        "configs": [
            {
                "name": config["name"],
                "description": config["description"],
                "grain": config["grain"],
                "row_count": len(config["rows"]),
                "columns": [
                    {key: column[key] for key in ("name", "type", "nullable", "description")}
                    for column in config["columns"]
                ],
            }
            for config in dataset["configs"]
        ],
    }


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative_files(directory: Path, *, exclude: frozenset[str] = frozenset()) -> list[str]:
    return sorted(
        rel
        for rel in (p.relative_to(directory).as_posix() for p in directory.rglob("*") if p.is_file())
        if rel not in exclude
    )


def coverage(dataset: Mapping[str, Any]) -> dict[str, Any]:
    by_name = {config["name"]: config for config in dataset["configs"]}
    result: dict[str, Any] = {}
    if "rates" in by_name and by_name["rates"]["rows"]:
        dates = [row["effective_date"] for row in by_name["rates"]["rows"]]
        result["rates_from"], result["rates_to"] = min(dates), max(dates)
    if "daily" in by_name and by_name["daily"]["rows"]:
        dates = [row["date"] for row in by_name["daily"]["rows"]]
        result["daily_from"], result["daily_to"] = min(dates), max(dates)
    return result


def expected_paths(dataset: Mapping[str, Any]) -> set[str]:
    paths = {"README.md", "NOTICE.md", "CHANGELOG.md", "VERSION", "SHA256SUMS", "provenance/build-manifest.json", "schema/data-dictionary.json"}
    for config in dataset["configs"]:
        name = config["name"]
        paths |= {f"data/{name}.parquet", f"exports/{name}.csv", f"schema/{name}.schema.json"}
    paths |= {f"exports/{name}.jsonl" for name in dataset["jsonl_configs"]}
    return paths


def validate_layout(directory: Path, dataset: Mapping[str, Any]) -> None:
    where = dataset["repo_id"]
    actual = set(relative_files(directory))
    expected = expected_paths(dataset)
    if expected - actual:
        fail(f"{where}: missing expected files: {', '.join(sorted(expected - actual))}")
    if actual - expected:
        fail(f"{where}: unexpected files: {', '.join(sorted(actual - expected))}")

    text = (directory / "README.md").read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        fail(f"{where}: README.md must begin with YAML front matter")
    end = text.find("\n---\n", 4)
    if end == -1:
        fail(f"{where}: README.md front matter is not closed")
    try:
        front = yaml.safe_load(text[4:end])
    except yaml.YAMLError as exc:
        fail(f"{where}: README.md front matter is invalid YAML: {exc}")
    if not isinstance(front, dict) or not isinstance(front.get("configs"), list):
        fail(f"{where}: README.md front matter must define configs")
    entries = front["configs"]
    names = [config["name"] for config in dataset["configs"]]
    if [entry.get("config_name") for entry in entries] != names:
        fail(f"{where}: README.md configs do not match the bundle configs in order")
    defaults = [entry["config_name"] for entry in entries if entry.get("default") is True]
    if defaults != [dataset["default_config"]]:
        fail(f"{where}: README.md must mark exactly {dataset['default_config']} as default (found {defaults})")
    for entry in entries:
        expected_files = [{"split": "full", "path": f"data/{entry['config_name']}.parquet"}]
        if entry.get("data_files") != expected_files:
            fail(f"{where}: README.md config {entry['config_name']} data_files must be {expected_files}")
    license_id = dataset["rights"].get("dataset_license")
    if license_id is None:
        if "license" in front:
            fail(f"{where}: README.md declares a license but rights.dataset_license is null")
    elif front.get("license") != license_id:
        fail(f"{where}: README.md license must equal rights.dataset_license ({license_id})")


def build_dataset(dataset: Mapping[str, Any], root: Path) -> dict[str, Any]:
    directory = root / dataset["dir"]
    validate_changelog(directory, dataset)

    (directory / "VERSION").write_bytes((dataset["version"] + "\n").encode("utf-8"))
    for name in STATIC_FILES:
        (directory / name).write_bytes(dataset["files"][name].encode("utf-8"))
    for name in GENERATED_DIRS:
        shutil.rmtree(directory / name, ignore_errors=True)
        (directory / name).mkdir()

    for config in dataset["configs"]:
        name = config["name"]
        write_parquet(directory / "data" / f"{name}.parquet", dataset, config)
        write_csv(directory / "exports" / f"{name}.csv", config)
        if name in dataset["jsonl_configs"]:
            write_jsonl(directory / "exports" / f"{name}.jsonl", config)
        write_json(directory / "schema" / f"{name}.schema.json", json_schema(dataset, config))
    write_json(directory / "schema" / "data-dictionary.json", data_dictionary(dataset))

    manifest_excluded = frozenset({"provenance/build-manifest.json", "SHA256SUMS"})
    counts = {config["name"]: len(config["rows"]) for config in dataset["configs"]}
    manifest = {
        "repo_id": dataset["repo_id"],
        "version": dataset["version"],
        "generated_at": dataset["generated_at"],
        "generator": GENERATOR,
        "generator_version": GENERATOR_VERSION,
        "country_codes": dataset["country_codes"],
        "releases": dataset["releases"],
        "record_counts_by_config": counts,
        "coverage": coverage(dataset),
        "rights": dataset["rights"],
        "output_checksums": {rel: sha256_file(directory / rel) for rel in relative_files(directory, exclude=manifest_excluded)},
    }
    write_json(directory / "provenance" / "build-manifest.json", manifest)

    sums = [f"{sha256_file(directory / rel)}  {rel}\n" for rel in relative_files(directory, exclude=frozenset({"SHA256SUMS"}))]
    (directory / "SHA256SUMS").write_bytes("".join(sums).encode("utf-8"))

    validate_layout(directory, dataset)
    return {"repo_id": dataset["repo_id"], "dir": dataset["dir"], "version": dataset["version"], "record_counts_by_config": counts}


def build(bundle_path: Path, root: Path, only: Sequence[str] = ()) -> list[dict[str, Any]]:
    try:
        bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"could not read bundle {bundle_path}: {exc}") from exc
    if not isinstance(bundle, dict) or bundle.get("bundle_version") != BUNDLE_VERSION or not isinstance(bundle.get("datasets"), list):
        fail(f"bundle must be an object with bundle_version {BUNDLE_VERSION} and a datasets array")
    datasets = [validate_dataset(dataset, i) for i, dataset in enumerate(bundle["datasets"])]
    dirs = [dataset["dir"] for dataset in datasets]
    if len(set(dirs)) != len(dirs) or len({d["repo_id"] for d in datasets}) != len(datasets):
        fail("bundle contains duplicate dir or repo_id values")

    if only:
        selected = [dataset for dataset in datasets if Path(dataset["dir"]).name in only or dataset["dir"] in only]
        unknown = set(only) - {Path(d["dir"]).name for d in selected} - {d["dir"] for d in selected}
        if unknown:
            fail(f"--only names not in bundle: {', '.join(sorted(unknown))}")
    else:
        selected = datasets
        known = {Path(d).name for d in dirs}
        parent = root / Path(dirs[0]).parent if dirs else None
        if parent is not None and parent.is_dir():
            stale = sorted(p.name for p in parent.iterdir() if p.is_dir() and p.name not in known)
            if stale:
                fail(f"{parent} contains datasets not in the bundle: {', '.join(stale)}")

    for dataset in selected:
        validate_changelog(root / dataset["dir"], dataset)
    return [build_dataset(dataset, root) for dataset in selected]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, default=DEFAULT_BUNDLE, help="bundle JSON from scripts/build-hf-tables.ts")
    parser.add_argument("--root", type=Path, default=ROOT, help="repository root; dataset folders are <root>/<dir>")
    parser.add_argument("--only", action="append", default=[], help="build only this dataset directory name (repeatable)")
    args = parser.parse_args()
    try:
        summary = build(args.bundle.resolve(), args.root.resolve(), args.only)
    except (OSError, ValueError, pa.ArrowException) as exc:
        print(f"build-hf-datasets: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({"status": "ok", "datasets": summary}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
