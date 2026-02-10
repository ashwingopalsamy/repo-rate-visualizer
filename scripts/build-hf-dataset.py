#!/usr/bin/env python3
"""Build the publication-ready Hugging Face RBI repo-rate dataset.

The SnapshotV2 decisions ledger is the only input.  Every other table in the
artifact is either a normalized source/context table or a deterministic view
derived from that ledger.  This script intentionally has no dependency on the
website runtime and does not modify any visualizer data files.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence
from urllib.parse import urlparse

import pyarrow as pa
import pyarrow.parquet as pq
import yaml


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "src" / "data" / "snapshot.json"
DEFAULT_OUTPUT = ROOT / "hf-dataset"
DATASET_SCHEMA_VERSION = "1.0.0"
GENERATOR_VERSION = "1.1.0"
DATASET_REPO_ID = "ashwingopalsamy/india-repo-rate-dataset"
CHECKSUM_PATTERN = re.compile(r"^sha256:[0-9a-f]{64}$")
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TRUSTED_EVENT_HOSTS = {"rbi.org.in", "cbic-gst.gov.in", "mha.gov.in"}

EXPECTED_TAGS = [
    "tabular",
    "timeseries",
    "finance",
    "economics",
    "monetary-policy",
    "central-banking",
    "india",
    "rbi",
    "interest-rates",
    "datasets",
    "pandas",
    "mlcroissant",
]

RIGHTS_METADATA = {
    "dataset_license": None,
    "license_status": "not_asserted",
    "official_status": "independent_non_official",
    "source_material_rights": "remain_with_respective_publishers",
    "notice_section": "Attribution & Usage",
    "reference_material_url": "https://rbi.org.in/scripts/PublicationsView.aspx?Id=18086",
}

CONFIG_NAMES = ("decisions", "annual", "sources", "events", "regimes")
CONFIG_PATHS = {name: f"data/{name}.parquet" for name in CONFIG_NAMES}
EXPECTED_ARTIFACT_PATHS = {
    "README.md",
    "NOTICE.md",
    "VERSION",
    "CHANGELOG.md",
    "SHA256SUMS",
    "provenance/build-manifest.json",
    "schema/data-dictionary.json",
    *(f"data/{name}.parquet" for name in CONFIG_NAMES),
    *(f"exports/{name}.csv" for name in CONFIG_NAMES),
    "exports/decisions.jsonl",
    "exports/annual.jsonl",
    *(f"schema/{name}.schema.json" for name in CONFIG_NAMES),
}

SOURCE_CLASS_BY_TYPE = {
    "policy-resolution": "official_primary",
    "dbie-key-rates": "official_primary",
    "policy-archive": "official_secondary",
    "policy-minutes": "official_secondary",
    "current-policy-rates": "official_secondary",
    "historical-rate-series": "legacy_import",
    "secondary-historical-reference": "legacy_import",
}
SOURCE_PRIORITY = {
    "policy-resolution": 100,
    "dbie-key-rates": 90,
    "policy-minutes": 70,
    "current-policy-rates": 60,
    "policy-archive": 50,
    "historical-rate-series": 30,
    "secondary-historical-reference": 20,
}


@dataclass(frozen=True)
class FieldSpec:
    name: str
    arrow_type: pa.DataType
    nullable: bool
    description: str
    source_native: bool = False
    derived: bool = False
    null_semantics: str = "Null means the value is unavailable in the canonical snapshot."


DATE32 = pa.date32()
TIMESTAMP_UTC = pa.timestamp("us", tz="UTC")


def field(
    name: str,
    arrow_type: pa.DataType,
    description: str,
    *,
    nullable: bool = False,
    source_native: bool = False,
    derived: bool = False,
    null_semantics: str | None = None,
) -> FieldSpec:
    return FieldSpec(
        name=name,
        arrow_type=arrow_type,
        nullable=nullable,
        description=description,
        source_native=source_native,
        derived=derived,
        null_semantics=null_semantics
        or ("Null means the value is unavailable in the canonical snapshot." if nullable else "Not nullable."),
    )


FIELD_SPECS: dict[str, tuple[FieldSpec, ...]] = {
    "decisions": (
        field("decision_id", pa.string(), "Stable dataset-generated identifier for one canonical ledger row."),
        field("snapshot_decision_id", pa.string(), "Original decision identifier from SnapshotV2.", source_native=True),
        field("canonical_key", pa.string(), "Globally readable instrument/date key: IN:RBI:policy_repo_rate:YYYY-MM-DD.", derived=True),
        field("jurisdiction", pa.string(), "ISO 3166-1 alpha-2 jurisdiction code: IN."),
        field("country", pa.string(), "Country name: India."),
        field("central_bank", pa.string(), "Central bank responsible for the instrument."),
        field("central_bank_code", pa.string(), "Short central-bank code: RBI."),
        field("decision_authority", pa.string(), "Authority identified by the source type, or null when not known.", nullable=True),
        field("instrument", pa.string(), "Human-readable policy instrument name."),
        field("instrument_code", pa.string(), "Stable machine-readable instrument code."),
        field("record_type", pa.string(), "policy_decision for a policy-resolution record; historical_rate_observation for imported history."),
        field("date_semantics", pa.string(), "Whether the date represents a resolution/effective date or a historical observation date."),
        field("decision_date", DATE32, "Date of the identified policy decision; null for imported historical observations.", nullable=True, source_native=False, derived=True, null_semantics="Null means no separate policy-decision date is identified by the source record."),
        field("effective_date", DATE32, "Date on which the canonical rate observation is effective or recorded.", source_native=True),
        field("year", pa.int32(), "Calendar year derived from effective_date.", derived=True),
        field("month", pa.int8(), "Calendar month number derived from effective_date.", derived=True),
        field("policy_rate_pct", pa.float64(), "Policy repo rate in percent, retained as a convenient numeric view.", source_native=True),
        field("policy_rate_bps", pa.int32(), "Policy repo rate in basis points; exactly round(policy_rate_pct * 100).", derived=True),
        field("previous_policy_rate_pct", pa.float64(), "Previous canonical policy rate in percent.", nullable=True, derived=True, null_semantics="Null for the first canonical observation."),
        field("previous_policy_rate_bps", pa.int32(), "Previous canonical policy rate in basis points.", nullable=True, derived=True, null_semantics="Null for the first canonical observation."),
        field("change_bps", pa.int32(), "Signed change from the previous canonical policy rate in basis points; zero for the initial observation.", source_native=True),
        field("action", pa.string(), "Canonical transition label: initial, hike, cut, or hold.", source_native=True),
        field("stance", pa.string(), "Monetary-policy stance when explicitly available.", nullable=True, source_native=True, null_semantics="Null means the canonical source does not provide a structured stance."),
        field("is_rate_change", pa.bool_(), "True when change_bps is non-zero.", derived=True),
        field("decision_summary", pa.string(), "Short deterministic factual summary generated from structured fields; source prose is not republished.", derived=True),
        field("regime_id", pa.string(), "Stable join key for the repository-provided regime interval containing effective_date.", nullable=True, derived=True, null_semantics="Null means effective_date falls in a gap between regime intervals."),
        field("regime_type", pa.string(), "Repository-provided contextual regime type.", nullable=True, source_native=True),
        field("regime_label", pa.string(), "Repository-provided contextual regime label.", nullable=True, source_native=True),
        field("primary_source_id", pa.string(), "Highest-priority source attached to this decision under the deterministic source-priority policy.", derived=True),
        field("primary_source_type", pa.string(), "Type of primary_source_id.", derived=True),
        field("primary_source_title", pa.string(), "Title of primary_source_id.", derived=True),
        field("primary_source_url", pa.string(), "URL of primary_source_id.", derived=True),
        field("primary_source_published_at", TIMESTAMP_UTC, "Publication timestamp of primary_source_id when supplied.", nullable=True, source_native=True, null_semantics="Null means the source record does not provide a publication timestamp."),
        field("primary_source_retrieved_at", TIMESTAMP_UTC, "Retrieval timestamp of primary_source_id.", source_native=True),
        field("primary_source_checksum", pa.string(), "SHA-256 checksum recorded for primary_source_id.", source_native=True),
        field("source_ids", pa.list_(pa.string()), "All source identifiers attached to the canonical row, sorted deterministically.", derived=True),
        field("source_count", pa.int32(), "Number of distinct attached source identifiers.", derived=True),
        field("provenance_class", pa.string(), "Strongest attached provenance class: official_primary, official_secondary, or legacy_import."),
        field("verification_status", pa.string(), "Deterministic verification label exposing primary, legacy, secondary, or mixed support."),
        field("snapshot_id", pa.string(), "SnapshotV2 identifier used as the build input.", source_native=True),
        field("snapshot_checksum", pa.string(), "SnapshotV2 content checksum used as the build input.", source_native=True),
        field("snapshot_retrieved_at", TIMESTAMP_UTC, "SnapshotV2 retrieval timestamp."),
        field("dataset_schema_version", pa.string(), "Independent semantic schema version for this dataset."),
        field("record_text", pa.string(), "Deterministically generated factual sentence intended for search, RAG, and agent use.", derived=True),
    ),
    "annual": (
        field("year", pa.int32(), "Calendar year, including years with no canonical ledger records."),
        field("start_policy_rate_pct", pa.float64(), "Rate in force immediately before January 1 of the year.", nullable=True, derived=True, null_semantics="Null when no earlier canonical rate is available."),
        field("end_policy_rate_pct", pa.float64(), "Rate in force on December 31 of the year.", nullable=True, derived=True, null_semantics="Null when no canonical rate is in force by year end."),
        field("min_policy_rate_pct", pa.float64(), "Minimum known in-force rate during the year, including a carry-in rate.", nullable=True, derived=True, null_semantics="Null when no canonical rate is known during the year."),
        field("max_policy_rate_pct", pa.float64(), "Maximum known in-force rate during the year, including a carry-in rate.", nullable=True, derived=True, null_semantics="Null when no canonical rate is known during the year."),
        field("net_change_bps", pa.int32(), "End rate minus start rate in basis points; null if either boundary is unknown.", nullable=True, derived=True, null_semantics="Null when start_policy_rate_pct or end_policy_rate_pct is null."),
        field("gross_hikes_bps", pa.int32(), "Sum of positive canonical transitions within the calendar year."),
        field("gross_cuts_bps", pa.int32(), "Absolute sum of negative canonical transitions within the calendar year."),
        field("decision_count", pa.int32(), "Count of all canonical ledger rows whose effective_date falls in the year."),
        field("policy_decision_count", pa.int32(), "Count of policy_decision rows in the year."),
        field("historical_observation_count", pa.int32(), "Count of historical_rate_observation rows in the year."),
        field("hike_count", pa.int32(), "Count of canonical rows labeled hike in the year."),
        field("cut_count", pa.int32(), "Count of canonical rows labeled cut in the year."),
        field("hold_count", pa.int32(), "Count of canonical rows labeled hold in the year."),
        field("first_decision_date", DATE32, "Effective date of the first canonical row in the year.", nullable=True, derived=True, null_semantics="Null when the year has no canonical ledger rows."),
        field("last_decision_date", DATE32, "Effective date of the last canonical row in the year.", nullable=True, derived=True, null_semantics="Null when the year has no canonical ledger rows."),
        field("year_end_action", pa.string(), "Action of the final in-year canonical row; null when the year-end rate is carried in from an earlier year.", nullable=True, derived=True, null_semantics="Null when no canonical row in the year establishes the year-end state."),
        field("year_end_stance", pa.string(), "Stance of the final in-year canonical row.", nullable=True, derived=True, null_semantics="Null when no in-year stance is available."),
        field("year_end_regime_id", pa.string(), "Regime containing December 31 under start-inclusive/end-exclusive matching.", nullable=True, derived=True, null_semantics="Null when December 31 falls in a regime gap."),
        field("year_end_regime_type", pa.string(), "Repository-provided regime type at December 31.", nullable=True, derived=True),
        field("year_end_regime_label", pa.string(), "Repository-provided regime label at December 31.", nullable=True, derived=True),
        field("year_end_source_id", pa.string(), "Primary source supporting the rate in force at year end.", nullable=True, derived=True, null_semantics="Null when no year-end rate is known."),
        field("year_end_source_url", pa.string(), "URL of year_end_source_id.", nullable=True, derived=True),
        field("source_count", pa.int32(), "Distinct sources used by in-year canonical rows and the year-end carry-in state."),
        field("provenance_summary", pa.string(), "Sorted pipe-delimited provenance classes represented in the year."),
        field("snapshot_id", pa.string(), "SnapshotV2 identifier used as the build input."),
        field("snapshot_checksum", pa.string(), "SnapshotV2 content checksum used as the build input."),
        field("snapshot_retrieved_at", TIMESTAMP_UTC, "SnapshotV2 retrieval timestamp."),
        field("dataset_schema_version", pa.string(), "Independent semantic schema version for this dataset."),
        field("record_text", pa.string(), "Deterministically generated factual annual summary for search, RAG, and agent use.", derived=True),
    ),
    "sources": (
        field("source_id", pa.string(), "Stable source identifier from SnapshotV2."),
        field("publisher", pa.string(), "Publisher derived from the source URL/domain."),
        field("source_type", pa.string(), "Source adapter/type from SnapshotV2.", source_native=True),
        field("title", pa.string(), "Source title from SnapshotV2.", source_native=True),
        field("url", pa.string(), "Authoritative source URL from SnapshotV2.", source_native=True),
        field("published_at", TIMESTAMP_UTC, "Source publication timestamp when supplied.", nullable=True, source_native=True, null_semantics="Null means the source record has no publication timestamp."),
        field("retrieved_at", TIMESTAMP_UTC, "Source retrieval timestamp.", source_native=True),
        field("checksum", pa.string(), "SHA-256 checksum recorded for the source.", source_native=True),
        field("is_primary_source", pa.bool_(), "Whether the source is classified as a direct primary RBI rate source."),
        field("provenance_class", pa.string(), "official_primary, official_secondary, or legacy_import."),
    ),
    "events": (
        field("event_id", pa.string(), "Stable contextual event identifier from SnapshotV2."),
        field("date", DATE32, "Calendar date of the contextual event.", source_native=True),
        field("label", pa.string(), "Short event label.", source_native=True),
        field("description", pa.string(), "Contextual event description from the repository snapshot.", source_native=True),
        field("event_type", pa.string(), "Repository event type.", source_native=True),
        field("citation_url", pa.string(), "Citation URL for the contextual event.", source_native=True),
    ),
    "regimes": (
        field("regime_id", pa.string(), "Stable deterministic regime interval identifier."),
        field("start_date", DATE32, "Inclusive start date of the contextual regime.", source_native=True),
        field("end_date", DATE32, "Exclusive end date of the contextual regime.", nullable=True, source_native=True, null_semantics="Null represents an open-ended interval."),
        field("regime_type", pa.string(), "Repository-provided contextual regime type.", source_native=True),
        field("label", pa.string(), "Repository-provided contextual regime label.", source_native=True),
    ),
}


def arrow_schema(config_name: str) -> pa.Schema:
    return pa.schema(
        [pa.field(spec.name, spec.arrow_type, nullable=spec.nullable) for spec in FIELD_SPECS[config_name]]
    )


def fail(message: str) -> None:
    raise ValueError(message)


def parse_date(value: Any, context: str) -> date:
    if not isinstance(value, str) or not DATE_PATTERN.fullmatch(value):
        fail(f"{context} must be a valid YYYY-MM-DD date")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"{context} must be a valid YYYY-MM-DD date") from exc


def parse_optional_date(value: Any, context: str) -> date | None:
    if value is None:
        return None
    return parse_date(value, context)


def parse_timestamp(value: Any, context: str) -> datetime:
    if not isinstance(value, str) or not value.strip():
        fail(f"{context} must be a timestamp")
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(f"{context} must be a valid ISO-8601 timestamp") from exc
    if parsed.tzinfo is None:
        fail(f"{context} must include a timezone")
    return parsed.astimezone(timezone.utc)


def timestamp_text(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def validate_url(value: Any, context: str) -> str:
    if not isinstance(value, str) or not value.strip():
        fail(f"{context} must be an http(s) URL")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or not parsed.hostname:
        fail(f"{context} must be an http(s) URL")
    return value


def validate_trusted_event_url(value: Any, context: str) -> str:
    url = validate_url(value, context)
    hostname = (urlparse(url).hostname or "").lower().rstrip(".")
    if not any(hostname == host or hostname.endswith(f".{host}") for host in TRUSTED_EVENT_HOSTS):
        fail(f"{context} must use an official RBI, RBI Docs, MHA, or CBIC domain")
    return url


def validate_checksum(value: Any, context: str) -> str:
    if not isinstance(value, str) or CHECKSUM_PATTERN.fullmatch(value) is None:
        fail(f"{context} must be a lowercase sha256:<64 hex> checksum")
    return value


def rate_bps(value: Any, context: str) -> tuple[Decimal, int]:
    if isinstance(value, bool) or not isinstance(value, (int, float, str, Decimal)):
        fail(f"{context} must be a finite positive number")
    try:
        decimal_value = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"{context} must be a finite positive number") from exc
    if not decimal_value.is_finite() or decimal_value <= 0:
        fail(f"{context} must be a finite positive number")
    bps_value = decimal_value * Decimal("100")
    rounded = bps_value.to_integral_value(rounding=ROUND_HALF_UP)
    if bps_value != rounded:
        fail(f"{context} has more precision than one basis point: {value!r}")
    return decimal_value, int(rounded)


def rate_text(bps: int) -> str:
    return f"{bps // 100}.{bps % 100:02d}%"


def signed_bps_text(value: int) -> str:
    return f"{value:+d}" if value else "0"


def action_for_change(change_bps: int, first: bool) -> str:
    if first:
        return "initial"
    if change_bps > 0:
        return "hike"
    if change_bps < 0:
        return "cut"
    return "hold"


def publisher_for_url(url: str) -> str:
    hostname = (urlparse(url).hostname or "").lower().rstrip(".")
    if hostname == "rbi.org.in" or hostname.endswith(".rbi.org.in"):
        return "Reserve Bank of India"
    if hostname == "reuters.com" or hostname.endswith(".reuters.com"):
        return "Reuters"
    if hostname == "shriramfinance.in" or hostname.endswith(".shriramfinance.in"):
        return "Shriram Finance"
    return hostname


def source_class(source_type: str) -> str:
    try:
        return SOURCE_CLASS_BY_TYPE[source_type]
    except KeyError as exc:
        raise ValueError(f"unsupported SnapshotV2 source type: {source_type!r}") from exc


def source_is_primary(source_type: str) -> bool:
    return source_type in {"policy-resolution", "dbie-key-rates"}


def stable_regime_id(regime: Mapping[str, Any]) -> str:
    start = regime["start_date"].isoformat()
    end = regime["end_date"].isoformat() if regime["end_date"] else "open"
    return f"regime-{start}-{end}-{regime['regime_type']}"


def snapshot_stable_content(snapshot: Mapping[str, Any]) -> dict[str, Any]:
    """Mirror fetch-rbi-data.js stableContent for independent checksum validation."""
    meta = dict(snapshot["meta"])
    meta["snapshotId"] = None
    meta["retrievedAt"] = None
    meta["checksum"] = None
    return {
        "schemaVersion": snapshot["schemaVersion"],
        "meta": meta,
        "current": snapshot["current"],
        "sources": [
            {key: value for key, value in source.items() if key != "retrievedAt"}
            for source in snapshot["sources"]
        ],
        "decisions": snapshot["decisions"],
        "rateSeries": snapshot["rateSeries"],
        "events": snapshot["events"],
        "regimes": snapshot["regimes"],
    }


def snapshot_content_checksum(snapshot: Mapping[str, Any]) -> str:
    payload = json.dumps(
        snapshot_stable_content(snapshot),
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return f"sha256:{hashlib.sha256(payload).hexdigest()}"


def validate_snapshot(snapshot: Any) -> dict[str, Any]:
    if not isinstance(snapshot, dict):
        fail("SnapshotV2 root must be an object")
    if snapshot.get("schemaVersion") != 2:
        fail("SnapshotV2 schemaVersion must be 2")
    for key in ("meta", "current", "sources", "decisions", "rateSeries", "events", "regimes"):
        if key not in snapshot:
            fail(f"SnapshotV2 root.{key} is required")
    meta = snapshot.get("meta")
    if not isinstance(meta, dict):
        fail("SnapshotV2 meta must be an object")
    for key in ("snapshotId", "retrievedAt", "latestOfficialDate", "checksum"):
        if key not in meta:
            fail(f"SnapshotV2 meta.{key} is required")
    if not isinstance(meta["snapshotId"], str) or not meta["snapshotId"].strip():
        fail("SnapshotV2 meta.snapshotId must be a non-empty string")
    parse_timestamp(meta["retrievedAt"], "SnapshotV2 meta.retrievedAt")
    parse_date(meta["latestOfficialDate"], "SnapshotV2 meta.latestOfficialDate")
    validate_checksum(meta["checksum"], "SnapshotV2 meta.checksum")
    expected_snapshot_checksum = snapshot_content_checksum(snapshot)
    if meta["checksum"] != expected_snapshot_checksum:
        fail(
            "SnapshotV2 meta.checksum does not match the stable snapshot content "
            f"(expected {expected_snapshot_checksum})"
        )
    if "latestSourcePublishedAt" in meta and meta["latestSourcePublishedAt"] is not None:
        parse_timestamp(meta["latestSourcePublishedAt"], "SnapshotV2 meta.latestSourcePublishedAt")
    if "sourceUrl" in meta:
        validate_url(meta["sourceUrl"], "SnapshotV2 meta.sourceUrl")

    sources = snapshot.get("sources")
    if not isinstance(sources, list) or not sources:
        fail("SnapshotV2 sources must be a non-empty array")
    source_by_id: dict[str, dict[str, Any]] = {}
    for index, source in enumerate(sources):
        context = f"SnapshotV2 sources[{index}]"
        if not isinstance(source, dict):
            fail(f"{context} must be an object")
        source_id = source.get("id")
        if not isinstance(source_id, str) or not source_id:
            fail(f"{context}.id is required")
        if source_id in source_by_id:
            fail(f"duplicate SnapshotV2 source id: {source_id}")
        source_type = source.get("type")
        if not isinstance(source_type, str) or not source_type:
            fail(f"{context}.type is required")
        source_class(source_type)
        for key in ("title", "url", "retrievedAt", "checksum"):
            if key not in source:
                fail(f"{context}.{key} is required")
        if not isinstance(source["title"], str) or not source["title"].strip():
            fail(f"{context}.title must be a non-empty string")
        validate_url(source["url"], f"{context}.url")
        parse_timestamp(source["retrievedAt"], f"{context}.retrievedAt")
        if source.get("publishedAt") is not None:
            parse_timestamp(source["publishedAt"], f"{context}.publishedAt")
        validate_checksum(source["checksum"], f"{context}.checksum")
        source_by_id[source_id] = source

    decisions = snapshot.get("decisions")
    if not isinstance(decisions, list) or not decisions:
        fail("SnapshotV2 decisions must be a non-empty array")
    decision_ids: set[str] = set()
    previous_date: date | None = None
    previous_bps: int | None = None
    normalized_decisions: list[dict[str, Any]] = []
    for index, decision in enumerate(decisions):
        context = f"SnapshotV2 decisions[{index}]"
        if not isinstance(decision, dict):
            fail(f"{context} must be an object")
        decision_id = decision.get("id")
        if not isinstance(decision_id, str) or not decision_id:
            fail(f"{context}.id is required")
        if decision_id in decision_ids:
            fail(f"duplicate SnapshotV2 decision id: {decision_id}")
        decision_ids.add(decision_id)
        effective_date = parse_date(decision.get("date"), f"{context}.date")
        if previous_date is not None and effective_date <= previous_date:
            fail(f"SnapshotV2 decisions must be strictly ordered by date at {context}.date")
        decimal_rate, current_bps = rate_bps(decision.get("repoRate"), f"{context}.repoRate")
        source_ids = decision.get("sourceIds")
        if not isinstance(source_ids, list) or not source_ids:
            fail(f"{context}.sourceIds must be a non-empty array")
        if any(not isinstance(source_id, str) or not source_id for source_id in source_ids):
            fail(f"{context}.sourceIds must contain non-empty strings")
        if len(set(source_ids)) != len(source_ids):
            fail(f"{context}.sourceIds contains duplicates")
        for source_id in source_ids:
            if source_id not in source_by_id:
                fail(f"{context} references unknown source id: {source_id}")
        change_bps = decision.get("changeBps")
        if isinstance(change_bps, bool) or not isinstance(change_bps, int):
            fail(f"{context}.changeBps must be an integer")
        expected_change = 0 if previous_bps is None else current_bps - previous_bps
        if change_bps != expected_change:
            fail(f"{context}.changeBps {change_bps} does not match canonical delta {expected_change}")
        action = decision.get("action")
        expected_action = action_for_change(expected_change, previous_bps is None)
        if action != expected_action:
            fail(f"{context}.action {action!r} does not match {expected_action!r}")
        stance = decision.get("stance")
        if stance is not None and (not isinstance(stance, str) or not stance.strip()):
            fail(f"{context}.stance must be a non-empty string or null")
        normalized_decisions.append(
            {
                "raw": decision,
                "id": decision_id,
                "date": effective_date,
                "rate": decimal_rate,
                "rate_bps": current_bps,
                "change_bps": change_bps,
                "action": action,
                "stance": stance,
                "source_ids": list(source_ids),
            }
        )
        previous_date = effective_date
        previous_bps = current_bps

    rate_series = snapshot.get("rateSeries")
    if not isinstance(rate_series, list) or len(rate_series) != len(decisions):
        fail("SnapshotV2 rateSeries must contain exactly one row per decision")
    for index, point in enumerate(rate_series):
        context = f"SnapshotV2 rateSeries[{index}]"
        if not isinstance(point, dict):
            fail(f"{context} must be an object")
        decision = normalized_decisions[index]
        if point.get("date") != decision["raw"].get("date"):
            fail(f"{context}.date does not match decisions[{index}].date")
        point_rate, _ = rate_bps(point.get("rate"), f"{context}.rate")
        if point_rate != decision["rate"]:
            fail(f"{context}.rate does not match decisions[{index}].repoRate")
        if point.get("decisionId") != decision["id"]:
            fail(f"{context}.decisionId does not match decisions[{index}].id")

    events = snapshot.get("events")
    if not isinstance(events, list):
        fail("SnapshotV2 events must be an array")
    event_ids: set[str] = set()
    normalized_events: list[dict[str, Any]] = []
    for index, event in enumerate(events):
        context = f"SnapshotV2 events[{index}]"
        if not isinstance(event, dict):
            fail(f"{context} must be an object")
        event_id = event.get("id")
        if not isinstance(event_id, str) or not event_id or event_id in event_ids:
            fail(f"{context}.id must be unique and non-empty")
        event_ids.add(event_id)
        event_date = parse_date(event.get("date"), f"{context}.date")
        for key in ("label", "description", "type"):
            if not isinstance(event.get(key), str) or not event[key].strip():
                fail(f"{context}.{key} must be a non-empty string")
        citation = event.get("citation")
        validate_trusted_event_url(citation, f"{context}.citation")
        normalized_events.append(
            {
                "event_id": event_id,
                "date": event_date,
                "label": event["label"],
                "description": event["description"],
                "event_type": event["type"],
                "citation_url": citation,
            }
        )

    regimes = snapshot.get("regimes")
    if not isinstance(regimes, list):
        fail("SnapshotV2 regimes must be an array")
    normalized_regimes: list[dict[str, Any]] = []
    previous_start: date | None = None
    previous_end: date | None = None
    regime_ids: set[str] = set()
    for index, regime in enumerate(regimes):
        context = f"SnapshotV2 regimes[{index}]"
        if not isinstance(regime, dict):
            fail(f"{context} must be an object")
        start_date = parse_date(regime.get("startDate"), f"{context}.startDate")
        end_date = parse_optional_date(regime.get("endDate"), f"{context}.endDate")
        if end_date is not None and end_date <= start_date:
            fail(f"{context}.endDate must be after startDate")
        if previous_start is not None and start_date < previous_start:
            fail(f"SnapshotV2 regimes must be sorted by startDate at {context}")
        if previous_end is not None and start_date < previous_end:
            fail(f"SnapshotV2 regimes overlap at {context}")
        for key in ("type", "label"):
            if not isinstance(regime.get(key), str) or not regime[key].strip():
                fail(f"{context}.{key} must be a non-empty string")
        normalized = {
            "start_date": start_date,
            "end_date": end_date,
            "regime_type": regime["type"],
            "label": regime["label"],
        }
        regime_id = stable_regime_id(normalized)
        if regime_id in regime_ids:
            fail(f"duplicate generated regime_id: {regime_id}")
        regime_ids.add(regime_id)
        normalized["regime_id"] = regime_id
        normalized_regimes.append(normalized)
        previous_start = start_date
        previous_end = end_date

    current = snapshot.get("current")
    if not isinstance(current, dict):
        fail("SnapshotV2 current must be an object")
    latest = normalized_decisions[-1]
    current_rate, current_bps = rate_bps(current.get("repoRate"), "SnapshotV2 current.repoRate")
    if current_rate != latest["rate"] or current.get("effectiveDate") != latest["raw"].get("date") or current.get("decisionId") != latest["id"]:
        fail("SnapshotV2 current does not match the latest canonical decision")
    if not isinstance(current.get("sourceIds"), list) or not current["sourceIds"]:
        fail("SnapshotV2 current.sourceIds must be a non-empty array")
    if any(not isinstance(source_id, str) or not source_id for source_id in current["sourceIds"]):
        fail("SnapshotV2 current.sourceIds must contain non-empty strings")
    if len(set(current["sourceIds"])) != len(current["sourceIds"]):
        fail("SnapshotV2 current.sourceIds contains duplicates")
    for source_id in current["sourceIds"]:
        if source_id not in source_by_id:
            fail(f"SnapshotV2 current references unknown source id: {source_id}")
    if current.get("stance") is not None and (not isinstance(current["stance"], str) or not current["stance"].strip()):
        fail("SnapshotV2 current.stance must be a non-empty string or null")

    return {
        "raw": snapshot,
        "meta": meta,
        "source_by_id": source_by_id,
        "decisions": normalized_decisions,
        "events": normalized_events,
        "regimes": normalized_regimes,
        "snapshot_retrieved_at": parse_timestamp(meta["retrievedAt"], "SnapshotV2 meta.retrievedAt"),
    }


def regime_for_date(regimes: Sequence[Mapping[str, Any]], target: date) -> Mapping[str, Any] | None:
    for regime in regimes:
        if target < regime["start_date"]:
            break
        if target >= regime["start_date"] and (regime["end_date"] is None or target < regime["end_date"]):
            return regime
    return None


def normalized_sources(validated: Mapping[str, Any]) -> list[dict[str, Any]]:
    result = []
    for source_id, source in sorted(validated["source_by_id"].items()):
        result.append(
            {
                "source_id": source_id,
                "publisher": publisher_for_url(source["url"]),
                "source_type": source["type"],
                "title": source["title"],
                "url": source["url"],
                "published_at": parse_timestamp(source["publishedAt"], f"source {source_id}.publishedAt") if source.get("publishedAt") else None,
                "retrieved_at": parse_timestamp(source["retrievedAt"], f"source {source_id}.retrievedAt"),
                "checksum": source["checksum"],
                "is_primary_source": source_is_primary(source["type"]),
                "provenance_class": source_class(source["type"]),
            }
        )
    return result


def primary_source(source_ids: Sequence[str], source_by_id: Mapping[str, Mapping[str, Any]]) -> Mapping[str, Any]:
    ordered = sorted(
        source_ids,
        key=lambda source_id: (-SOURCE_PRIORITY[source_by_id[source_id]["type"]], source_id),
    )
    return source_by_id[ordered[0]]


def verification_status(classes: set[str]) -> str:
    if len(classes) > 1:
        return "mixed_provenance"
    if "official_primary" in classes:
        return "verified_primary_source"
    if "legacy_import" in classes:
        return "historical_legacy_source"
    return "official_secondary_source"


def build_record_text(
    *,
    effective_date: date,
    rate_bps_value: int,
    previous_bps: int | None,
    change_bps: int,
    action: str,
    stance: str | None,
    is_policy_decision: bool,
) -> str:
    date_text = effective_date.isoformat()
    if not is_policy_decision:
        if previous_bps is None:
            text = f"On {date_text}, the Reserve Bank of India historical policy repo-rate series first records {rate_text(rate_bps_value)}; no previous canonical rate is available."
        else:
            text = f"On {date_text}, the Reserve Bank of India historical policy repo-rate series records the policy repo rate at {rate_text(rate_bps_value)}, a change of {signed_bps_text(change_bps)} basis points from the previous canonical record. The canonical action is {action}."
    elif previous_bps is None:
        text = f"On {date_text}, the Reserve Bank of India Monetary Policy Committee recorded the policy repo rate at {rate_text(rate_bps_value)}; no previous canonical rate is available."
    elif action == "hold":
        text = f"On {date_text}, the Reserve Bank of India Monetary Policy Committee held the policy repo rate at {rate_text(rate_bps_value)}, a change of {signed_bps_text(change_bps)} basis points."
    elif action == "hike":
        text = f"On {date_text}, the Reserve Bank of India Monetary Policy Committee raised the policy repo rate to {rate_text(rate_bps_value)}, a change of {signed_bps_text(change_bps)} basis points."
    else:
        text = f"On {date_text}, the Reserve Bank of India Monetary Policy Committee lowered the policy repo rate to {rate_text(rate_bps_value)}, a change of {signed_bps_text(change_bps)} basis points."
    if stance is not None:
        text += f" The monetary policy stance was {stance}."
    return text


def build_decision_summary(
    *,
    rate_bps_value: int,
    previous_bps: int | None,
    change_bps: int,
    action: str,
    stance: str | None,
    is_policy_decision: bool,
) -> str:
    if previous_bps is None:
        prefix = "Policy decision" if is_policy_decision else "Historical rate observation"
        summary = f"{prefix}: policy repo rate {rate_text(rate_bps_value)}; no previous canonical rate."
    else:
        prefix = "Policy decision" if is_policy_decision else "Historical rate observation"
        summary = f"{prefix}: policy repo rate {rate_text(rate_bps_value)}; change {signed_bps_text(change_bps)} bps; action {action}."
    if stance is not None:
        summary += f" Stance: {stance}."
    return summary


def build_decisions(validated: Mapping[str, Any]) -> list[dict[str, Any]]:
    source_by_id = validated["source_by_id"]
    result: list[dict[str, Any]] = []
    for item in validated["decisions"]:
        raw = item["raw"]
        source_ids = sorted(item["source_ids"])
        attached_sources = [source_by_id[source_id] for source_id in source_ids]
        is_policy_decision = any(source["type"] == "policy-resolution" for source in attached_sources)
        record_type = "policy_decision" if is_policy_decision else "historical_rate_observation"
        date_semantics = "decision_and_effective_date" if is_policy_decision else "historical_rate_observation_date"
        authority = "Monetary Policy Committee" if is_policy_decision else None
        classes = {source_class(source["type"]) for source in attached_sources}
        strongest_class = min(
            classes,
            key=lambda value: {"official_primary": 0, "official_secondary": 1, "legacy_import": 2}[value],
        )
        source = primary_source(source_ids, source_by_id)
        regime = regime_for_date(validated["regimes"], item["date"])
        decision_id = f"decision-IN-RBI-policy_repo_rate-{item['date'].isoformat()}"
        canonical_key = f"IN:RBI:policy_repo_rate:{item['date'].isoformat()}"
        if result and result[-1]["effective_date"] >= item["date"]:
            fail(f"generated decision dates are not strictly ordered at {item['id']}")
        result.append(
            {
                "decision_id": decision_id,
                "snapshot_decision_id": item["id"],
                "canonical_key": canonical_key,
                "jurisdiction": "IN",
                "country": "India",
                "central_bank": "Reserve Bank of India",
                "central_bank_code": "RBI",
                "decision_authority": authority,
                "instrument": "Repo Rate",
                "instrument_code": "policy_repo_rate",
                "record_type": record_type,
                "date_semantics": date_semantics,
                "decision_date": item["date"] if is_policy_decision else None,
                "effective_date": item["date"],
                "year": item["date"].year,
                "month": item["date"].month,
                "policy_rate_pct": float(item["rate"]),
                "policy_rate_bps": item["rate_bps"],
                "previous_policy_rate_pct": float(result[-1]["policy_rate_bps"] / 100) if result else None,
                "previous_policy_rate_bps": result[-1]["policy_rate_bps"] if result else None,
                "change_bps": item["change_bps"],
                "action": item["action"],
                "stance": item["stance"],
                "is_rate_change": item["change_bps"] != 0,
                "decision_summary": build_decision_summary(
                    rate_bps_value=item["rate_bps"],
                    previous_bps=result[-1]["policy_rate_bps"] if result else None,
                    change_bps=item["change_bps"],
                    action=item["action"],
                    stance=item["stance"],
                    is_policy_decision=is_policy_decision,
                ),
                "regime_id": regime["regime_id"] if regime else None,
                "regime_type": regime["regime_type"] if regime else None,
                "regime_label": regime["label"] if regime else None,
                "primary_source_id": source["id"],
                "primary_source_type": source["type"],
                "primary_source_title": source["title"],
                "primary_source_url": source["url"],
                "primary_source_published_at": parse_timestamp(source["publishedAt"], f"source {source['id']}.publishedAt") if source.get("publishedAt") else None,
                "primary_source_retrieved_at": parse_timestamp(source["retrievedAt"], f"source {source['id']}.retrievedAt"),
                "primary_source_checksum": source["checksum"],
                "source_ids": source_ids,
                "source_count": len(source_ids),
                "provenance_class": strongest_class,
                "verification_status": verification_status(classes),
                "snapshot_id": validated["meta"]["snapshotId"],
                "snapshot_checksum": validated["meta"]["checksum"],
                "snapshot_retrieved_at": validated["snapshot_retrieved_at"],
                "dataset_schema_version": DATASET_SCHEMA_VERSION,
                "record_text": build_record_text(
                    effective_date=item["date"],
                    rate_bps_value=item["rate_bps"],
                    previous_bps=result[-1]["policy_rate_bps"] if result else None,
                    change_bps=item["change_bps"],
                    action=item["action"],
                    stance=item["stance"],
                    is_policy_decision=is_policy_decision,
                ),
            }
        )
    return result


def date_range(start_year: int, end_year: int) -> Iterable[int]:
    return range(start_year, end_year + 1)


def end_of_year(year: int) -> date:
    return date(year, 12, 31)


def build_annual(validated: Mapping[str, Any], decisions: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    if not decisions:
        return []
    first_year = decisions[0]["effective_date"].year
    latest_year = decisions[-1]["effective_date"].year
    rows: list[dict[str, Any]] = []
    for year in date_range(first_year, latest_year):
        year_rows = [row for row in decisions if row["effective_date"].year == year]
        start_state = next((row for row in reversed(decisions) if row["effective_date"] < date(year, 1, 1)), None)
        end_state = next((row for row in reversed(decisions) if row["effective_date"] <= end_of_year(year)), None)
        known_rows = list(year_rows)
        if start_state is not None:
            known_rows.insert(0, start_state)
        known_rates = [row["policy_rate_bps"] for row in known_rows]
        net_change = None
        if start_state is not None and end_state is not None:
            net_change = end_state["policy_rate_bps"] - start_state["policy_rate_bps"]
        gross_hikes = sum(row["change_bps"] for row in year_rows if row["change_bps"] > 0)
        gross_cuts = sum(abs(row["change_bps"]) for row in year_rows if row["change_bps"] < 0)
        in_year_source_ids = {source_id for row in year_rows for source_id in row["source_ids"]}
        if start_state is not None:
            in_year_source_ids.update(start_state["source_ids"])
        if end_state is not None:
            in_year_source_ids.update(end_state["source_ids"])
        classes = {row["provenance_class"] for row in year_rows}
        if start_state is not None:
            classes.add(start_state["provenance_class"])
        if end_state is not None:
            classes.add(end_state["provenance_class"])
        year_end_regime = regime_for_date(validated["regimes"], end_of_year(year))
        year_end_in_year = end_state is not None and end_state["effective_date"].year == year
        rate_text_value = rate_text(end_state["policy_rate_bps"]) if end_state else None
        if start_state is None and end_state is None:
            record_text = f"In {year}, no canonical policy repo rate is available in the dataset."
        elif not year_rows and end_state is not None:
            record_text = f"In {year}, the Reserve Bank of India policy repo rate remained at {rate_text_value} throughout the year; no canonical ledger records fall in this calendar year."
        else:
            if net_change is None:
                record_text = (
                    f"In {year}, the Reserve Bank of India policy repo rate ranged from "
                    f"{rate_text(min(known_rates))} to {rate_text(max(known_rates))}; "
                    "the net change is not computable because the start-of-year boundary is unavailable. "
                    f"The year contains {len(year_rows)} canonical ledger record{'' if len(year_rows) == 1 else 's'}."
                )
            else:
                record_text = (
                    f"In {year}, the Reserve Bank of India policy repo rate ranged from "
                    f"{rate_text(min(known_rates))} to {rate_text(max(known_rates))}; "
                    f"a net change of {signed_bps_text(net_change)} basis points was recorded across "
                    f"{len(year_rows)} canonical ledger record{'' if len(year_rows) == 1 else 's'}."
                )
        rows.append(
            {
                "year": year,
                "start_policy_rate_pct": float(start_state["policy_rate_bps"] / 100) if start_state else None,
                "end_policy_rate_pct": float(end_state["policy_rate_bps"] / 100) if end_state else None,
                "min_policy_rate_pct": float(min(known_rates) / 100) if known_rates else None,
                "max_policy_rate_pct": float(max(known_rates) / 100) if known_rates else None,
                "net_change_bps": net_change,
                "gross_hikes_bps": gross_hikes,
                "gross_cuts_bps": gross_cuts,
                "decision_count": len(year_rows),
                "policy_decision_count": sum(row["record_type"] == "policy_decision" for row in year_rows),
                "historical_observation_count": sum(row["record_type"] == "historical_rate_observation" for row in year_rows),
                "hike_count": sum(row["action"] == "hike" for row in year_rows),
                "cut_count": sum(row["action"] == "cut" for row in year_rows),
                "hold_count": sum(row["action"] == "hold" for row in year_rows),
                "first_decision_date": year_rows[0]["effective_date"] if year_rows else None,
                "last_decision_date": year_rows[-1]["effective_date"] if year_rows else None,
                "year_end_action": end_state["action"] if year_end_in_year else None,
                "year_end_stance": end_state["stance"] if year_end_in_year else None,
                "year_end_regime_id": year_end_regime["regime_id"] if year_end_regime else None,
                "year_end_regime_type": year_end_regime["regime_type"] if year_end_regime else None,
                "year_end_regime_label": year_end_regime["label"] if year_end_regime else None,
                "year_end_source_id": end_state["primary_source_id"] if end_state else None,
                "year_end_source_url": end_state["primary_source_url"] if end_state else None,
                "source_count": len(in_year_source_ids),
                "provenance_summary": "|".join(sorted(classes)) if classes else None,
                "snapshot_id": validated["meta"]["snapshotId"],
                "snapshot_checksum": validated["meta"]["checksum"],
                "snapshot_retrieved_at": validated["snapshot_retrieved_at"],
                "dataset_schema_version": DATASET_SCHEMA_VERSION,
                "record_text": record_text,
            }
        )
    return rows


def build_events(validated: Mapping[str, Any]) -> list[dict[str, Any]]:
    return sorted(validated["events"], key=lambda row: (row["date"], row["event_id"]))


def build_regimes(validated: Mapping[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "regime_id": row["regime_id"],
            "start_date": row["start_date"],
            "end_date": row["end_date"],
            "regime_type": row["regime_type"],
            "label": row["label"],
        }
        for row in validated["regimes"]
    ]


def json_type_for(spec: FieldSpec) -> dict[str, Any]:
    arrow_type = spec.arrow_type
    if pa.types.is_string(arrow_type):
        value: dict[str, Any] = {"type": "string"}
    elif pa.types.is_boolean(arrow_type):
        value = {"type": "boolean"}
    elif pa.types.is_integer(arrow_type):
        value = {"type": "integer"}
    elif pa.types.is_floating(arrow_type):
        value = {"type": "number"}
    elif pa.types.is_date32(arrow_type):
        value = {"type": "string", "format": "date"}
    elif pa.types.is_timestamp(arrow_type):
        value = {"type": "string", "format": "date-time"}
    elif pa.types.is_list(arrow_type):
        value = {"type": "array", "items": {"type": "string"}}
    else:
        fail(f"no JSON Schema mapping for Arrow type {arrow_type}")
    if spec.nullable:
        value["type"] = [value["type"], "null"]
    return value


def schema_json(config_name: str) -> dict[str, Any]:
    properties: dict[str, Any] = {}
    required: list[str] = []
    for spec in FIELD_SPECS[config_name]:
        properties[spec.name] = {
            **json_type_for(spec),
            "description": spec.description,
            "x-arrow-type": str(spec.arrow_type),
            "x-source-native": spec.source_native,
            "x-derived": spec.derived,
            "x-null-semantics": spec.null_semantics,
        }
        if not spec.nullable:
            required.append(spec.name)
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": f"https://huggingface.co/datasets/{DATASET_REPO_ID}/raw/main/schema/{config_name}.schema.json",
        "title": f"RBI repo-rate dataset — {config_name}",
        "description": f"Schema for the {config_name} configuration of the independent RBI repo-rate dataset.",
        "type": "object",
        "additionalProperties": False,
        "properties": properties,
        "required": required,
        "x-dataset-schema-version": DATASET_SCHEMA_VERSION,
        "x-config-name": config_name,
        "x-row-grain": {
            "decisions": "one row per canonical monetary-policy/rate observation",
            "annual": "one row per calendar year from the earliest through latest snapshot year",
            "sources": "one row per source document/resource",
            "events": "one row per contextual macro/policy event",
            "regimes": "one row per repository-provided regime interval",
        }[config_name],
    }


def data_dictionary(validated: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "dataset_name": "RBI policy repo-rate and monetary-policy decision history",
        "dataset_repo_id": DATASET_REPO_ID,
        "dataset_schema_version": DATASET_SCHEMA_VERSION,
        "canonical_configuration": "decisions",
        "rights": RIGHTS_METADATA,
        "source_snapshot": {
            "snapshot_id": validated["meta"]["snapshotId"],
            "snapshot_checksum": validated["meta"]["checksum"],
            "retrieved_at": validated["meta"]["retrievedAt"],
        },
        "configurations": {
            config_name: {
                "row_grain": {
                    "decisions": "one row per canonical monetary-policy/rate observation",
                    "annual": "one row per calendar year from the earliest through latest snapshot year",
                    "sources": "one row per source document/resource",
                    "events": "one row per contextual macro/policy event",
                    "regimes": "one row per repository-provided regime interval",
                }[config_name],
                "parquet_path": CONFIG_PATHS[config_name],
                "fields": [
                    {
                        "name": spec.name,
                        "arrow_type": str(spec.arrow_type),
                        "nullable": spec.nullable,
                        "description": spec.description,
                        "source_native": spec.source_native,
                        "derived": spec.derived,
                        "null_semantics": spec.null_semantics,
                    }
                    for spec in FIELD_SPECS[config_name]
                ],
            }
            for config_name in CONFIG_NAMES
        },
        "relationships": [
            "decisions.source_ids resolves to sources.source_id.",
            "decisions.primary_source_id and annual.year_end_source_id resolve to sources.source_id.",
            "decisions.regime_id and annual.year_end_regime_id resolve to regimes.regime_id when non-null.",
            "events are contextual and are not joined to decisions or interpreted as causal explanations.",
        ],
        "semantic_rules": [
            "Parquet is canonical; CSV and JSONL are interoperability exports and are not additional Hugging Face configurations.",
            "decision_date is null for imported historical observations because the source does not identify a separate policy decision date.",
            "effective_date is the canonical ledger ordering/effective date for every decision row.",
            "annual start rate is the latest known rate strictly before January 1; end rate is the latest known rate on or before December 31.",
            "annual gross hikes and gross cuts use only canonical transitions within that year; a first observation is not a hike or cut.",
            "regime intervals use start-inclusive/end-exclusive matching; gaps remain null.",
            "unknown values are typed nulls, never empty strings or sentinel labels.",
        ],
        "csv_conventions": {
            "null": "empty cell",
            "lists": "compact JSON arrays, for example [\"source-a\",\"source-b\"]",
            "booleans": "true or false",
            "timestamps": "UTC ISO-8601 text ending in Z",
        },
    }


def serialize_value(value: Any) -> Any:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, datetime):
        return timestamp_text(value)
    if isinstance(value, list):
        return [serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize_value(item) for key, item in value.items()}
    return value


def csv_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return json.dumps(serialize_value(value), ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(serialize_value(value))


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_jsonl(path: Path, rows: Sequence[Mapping[str, Any]], fields: Sequence[FieldSpec]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            ordered = {spec.name: serialize_value(row.get(spec.name)) for spec in fields}
            handle.write(json.dumps(ordered, ensure_ascii=False, separators=(",", ":")) + "\n")


def write_csv(path: Path, rows: Sequence[Mapping[str, Any]], fields: Sequence[FieldSpec]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[spec.name for spec in fields],
            lineterminator="\n",
            extrasaction="raise",
        )
        writer.writeheader()
        for row in rows:
            writer.writerow({spec.name: csv_value(row.get(spec.name)) for spec in fields})


def write_parquet(path: Path, rows: Sequence[Mapping[str, Any]], config_name: str) -> None:
    schema = arrow_schema(config_name).with_metadata(
        {
            b"dataset_schema_version": DATASET_SCHEMA_VERSION.encode("utf-8"),
            b"config_name": config_name.encode("utf-8"),
            b"canonical_format": b"parquet",
        }
    )
    table = pa.Table.from_pylist(list(rows), schema=schema)
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


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative_files(output_dir: Path, *, exclude: set[str] | None = None) -> list[Path]:
    excluded = exclude or set()
    return sorted(
        path
        for path in output_dir.rglob("*")
        if path.is_file() and path.relative_to(output_dir).as_posix() not in excluded
    )


def validate_output_layout(output_dir: Path) -> None:
    actual_paths = {path.relative_to(output_dir).as_posix() for path in relative_files(output_dir)}
    missing = sorted(EXPECTED_ARTIFACT_PATHS - actual_paths)
    unexpected = sorted(actual_paths - EXPECTED_ARTIFACT_PATHS)
    if missing:
        fail(f"dataset artifact is missing expected files: {', '.join(missing)}")
    if unexpected:
        fail(f"dataset artifact contains unexpected files: {', '.join(unexpected)}")


def validate_notice(output_dir: Path) -> None:
    notice = output_dir / "NOTICE.md"
    text = notice.read_text(encoding="utf-8")
    required_fragments = (
        "# Attribution & Usage",
        "independent, non-official educational reference",
        "publicly available records",
        "does not claim ownership of third-party material",
        "not created by, affiliated with, authorised by, sponsored by, or endorsed by the Reserve Bank of India",
        "without representation or warranty",
        "should not be used as the sole basis for any decision",
        "Nothing here constitutes financial, investment, legal, tax, accounting, or other professional advice",
        "This notice is not a dataset license",
        RIGHTS_METADATA["reference_material_url"],
    )
    for fragment in required_fragments:
        if fragment not in text:
            fail(f"NOTICE.md is missing required rights language: {fragment}")


def update_readme_build_summary(output_dir: Path, validated: Mapping[str, Any], row_sets: Mapping[str, Sequence[Mapping[str, Any]]]) -> None:
    readme = output_dir / "README.md"
    text = readme.read_text(encoding="utf-8")
    start_marker = "<!-- BUILD-SUMMARY:START -->"
    end_marker = "<!-- BUILD-SUMMARY:END -->"
    if text.count(start_marker) != 1 or text.count(end_marker) != 1:
        fail("README.md must contain exactly one build-summary marker pair")
    start = text.index(start_marker)
    end = text.index(end_marker, start) + len(end_marker)
    decisions = row_sets["decisions"]
    snapshot = validated["meta"]
    summary = "\n".join(
        (
            start_marker,
            (
                f"**Current build:** SnapshotV2 `{snapshot['snapshotId']}`, retrieved "
                f"`{snapshot['retrievedAt']}`; coverage `{decisions[0]['effective_date'].isoformat()}` "
                f"to `{decisions[-1]['effective_date'].isoformat()}`; "
                f"{len(decisions)} canonical records, {len(row_sets['annual'])} annual rows, "
                f"{len(row_sets['sources'])} sources, {len(row_sets['events'])} contextual events, "
                f"and {len(row_sets['regimes'])} regime intervals."
            ),
            end_marker,
        )
    )
    readme.write_text(text[:start] + summary + text[end:], encoding="utf-8", newline="\n")


def validate_readme_configs(output_dir: Path) -> None:
    readme = output_dir / "README.md"
    if not readme.exists():
        fail("hf-dataset/README.md is required")
    text = readme.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        fail("README.md must begin with YAML frontmatter")
    end = text.find("\n---\n", 4)
    if end == -1:
        fail("README.md YAML frontmatter is not closed")
    try:
        frontmatter = yaml.safe_load(text[4:end])
    except yaml.YAMLError as exc:
        raise ValueError(f"README.md YAML frontmatter is invalid: {exc}") from exc
    if not isinstance(frontmatter, dict):
        fail("README.md frontmatter must be a mapping")
    if frontmatter.get("language") != "en":
        fail("README.md frontmatter must declare language: en")
    if frontmatter.get("pretty_name") != "India RBI Policy Repo Rate and Monetary Policy Decision History":
        fail("README.md frontmatter has an unexpected pretty_name")
    if frontmatter.get("tags") != EXPECTED_TAGS:
        fail("README.md frontmatter tags must match the canonical discoverability list")
    if frontmatter.get("size_categories") != ["n<1K"]:
        fail("README.md frontmatter must declare size_categories: [n<1K]")
    configs = frontmatter.get("configs")
    if not isinstance(configs, list) or [item.get("config_name") for item in configs] != list(CONFIG_NAMES):
        fail("README.md must define exactly the five configurations in canonical order")
    if sum(bool(item.get("default")) for item in configs) != 1 or not configs[0].get("default"):
        fail("README.md must mark decisions as the sole default configuration")
    for config_name, item in zip(CONFIG_NAMES, configs):
        if set(item) - {"config_name", "default", "data_files"}:
            fail(f"README.md configuration {config_name} contains unsupported mapping keys")
        data_files = item.get("data_files")
        if not isinstance(data_files, list) or len(data_files) != 1:
            fail(f"README.md configuration {config_name} must have one data file")
        data_file = data_files[0]
        if data_file != {"split": "full", "path": CONFIG_PATHS[config_name]}:
            fail(f"README.md configuration {config_name} must map the full split to {CONFIG_PATHS[config_name]}")
    if "license" in frontmatter or "license_name" in frontmatter or "license_link" in frontmatter:
        fail("README.md must not claim a dataset license without established redistribution rights")
    if DATASET_REPO_ID not in text or "<user-or-org>" in text:
        fail("README.md must use the published dataset repository identifier")
    if "## Attribution & Usage" not in text:
        fail("README.md must contain the visible Attribution & Usage section")


def validate_rows(
    validated: Mapping[str, Any],
    decisions: Sequence[Mapping[str, Any]],
    annual: Sequence[Mapping[str, Any]],
    sources: Sequence[Mapping[str, Any]],
    events: Sequence[Mapping[str, Any]],
    regimes: Sequence[Mapping[str, Any]],
) -> None:
    if len({row["decision_id"] for row in decisions}) != len(decisions):
        fail("decision_id must be unique")
    if len({row["canonical_key"] for row in decisions}) != len(decisions):
        fail("canonical_key must be unique")
    for index, row in enumerate(decisions):
        if index and decisions[index - 1]["effective_date"] >= row["effective_date"]:
            fail("decision effective dates must be monotonically ordered")
        if not isinstance(row["policy_rate_pct"], float) or not math.isfinite(row["policy_rate_pct"]) or row["policy_rate_pct"] <= 0:
            fail(f"policy_rate_pct must be finite and positive for {row['decision_id']}")
        expected_rate_bps = int(
            (Decimal(str(row["policy_rate_pct"])) * Decimal("100")).to_integral_value(rounding=ROUND_HALF_UP)
        )
        if row["policy_rate_bps"] != expected_rate_bps:
            fail(f"policy_rate_bps mismatch for {row['decision_id']}")
        if row["is_rate_change"] != (row["change_bps"] != 0):
            fail(f"is_rate_change mismatch for {row['decision_id']}")
        expected_action = action_for_change(row["change_bps"], index == 0)
        if row["action"] != expected_action:
            fail(f"action mismatch for {row['decision_id']}: expected {expected_action}")
        if index == 0:
            if row["previous_policy_rate_bps"] is not None or row["change_bps"] != 0 or row["action"] != "initial":
                fail("initial decision previous-rate/action invariant failed")
        else:
            previous = decisions[index - 1]
            if row["previous_policy_rate_bps"] != previous["policy_rate_bps"]:
                fail(f"previous_policy_rate_bps mismatch for {row['decision_id']}")
            if row["previous_policy_rate_pct"] != previous["policy_rate_pct"]:
                fail(f"previous_policy_rate_pct mismatch for {row['decision_id']}")
            if row["change_bps"] != row["policy_rate_bps"] - previous["policy_rate_bps"]:
                fail(f"change_bps mismatch for {row['decision_id']}")
        if len(row["source_ids"]) != len(set(row["source_ids"])):
            fail(f"source_ids must be unique for {row['decision_id']}")
        if any(source_id not in validated["source_by_id"] for source_id in row["source_ids"]):
            fail(f"unresolved source reference for {row['decision_id']}")
        if row["primary_source_id"] not in row["source_ids"]:
            fail(f"primary source is not attached for {row['decision_id']}")
        if row["record_type"] == "historical_rate_observation" and row["decision_date"] is not None:
            fail(f"historical observation fabricated a decision date for {row['decision_id']}")
        if row["record_type"] == "policy_decision" and row["decision_date"] != row["effective_date"]:
            fail(f"policy decision date/effective date mismatch for {row['decision_id']}")

    expected_years = list(date_range(decisions[0]["effective_date"].year, decisions[-1]["effective_date"].year))
    if [row["year"] for row in annual] != expected_years:
        fail("annual must contain every calendar year from earliest through latest snapshot year")
    decisions_by_year: dict[int, list[Mapping[str, Any]]] = {year: [] for year in expected_years}
    for row in decisions:
        decisions_by_year[row["year"]].append(row)
    for annual_row in annual:
        year = annual_row["year"]
        year_rows = decisions_by_year[year]
        if annual_row["decision_count"] != len(year_rows):
            fail(f"annual decision_count does not reconcile for {year}")
        if annual_row["policy_decision_count"] + annual_row["historical_observation_count"] != annual_row["decision_count"]:
            fail(f"annual record-type counts do not reconcile for {year}")
        if annual_row["gross_hikes_bps"] != sum(row["change_bps"] for row in year_rows if row["change_bps"] > 0):
            fail(f"annual gross_hikes_bps does not reconcile for {year}")
        if annual_row["gross_cuts_bps"] != sum(abs(row["change_bps"]) for row in year_rows if row["change_bps"] < 0):
            fail(f"annual gross_cuts_bps does not reconcile for {year}")
        expected_net_change = None
        if annual_row["start_policy_rate_pct"] is not None and annual_row["end_policy_rate_pct"] is not None:
            expected_net_change = int(
                (
                    Decimal(str(annual_row["end_policy_rate_pct"]))
                    - Decimal(str(annual_row["start_policy_rate_pct"]))
                )
                * Decimal("100")
            )
        if annual_row["net_change_bps"] != expected_net_change:
            fail(f"annual net_change_bps does not reconcile for {year}")
        if annual_row["hike_count"] != sum(row["action"] == "hike" for row in year_rows):
            fail(f"annual hike_count does not reconcile for {year}")
        if annual_row["cut_count"] != sum(row["action"] == "cut" for row in year_rows):
            fail(f"annual cut_count does not reconcile for {year}")
        if annual_row["hold_count"] != sum(row["action"] == "hold" for row in year_rows):
            fail(f"annual hold_count does not reconcile for {year}")
        if year == 2021 and annual_row["decision_count"] != 0:
            fail("2021 must remain represented as a zero-decision year")
        if annual_row["end_policy_rate_pct"] is not None:
            end_state = next((row for row in reversed(decisions) if row["effective_date"] <= end_of_year(year)), None)
            if end_state is None or annual_row["end_policy_rate_pct"] != end_state["policy_rate_pct"]:
                fail(f"annual end rate does not match in-force state for {year}")
            if annual_row["year_end_source_id"] != end_state["primary_source_id"]:
                fail(f"annual year-end source does not match in-force state for {year}")
        elif annual_row["year_end_source_id"] is not None:
            fail(f"annual year-end source must be null without an in-force rate for {year}")
        if annual_row["year_end_source_id"] is not None and annual_row["year_end_source_id"] not in validated["source_by_id"]:
            fail(f"annual year-end source does not resolve for {year}")
    source_ids = {row["source_id"] for row in sources}
    if source_ids != set(validated["source_by_id"]):
        fail("sources configuration does not exactly represent SnapshotV2 sources")
    if len({row["event_id"] for row in events}) != len(events):
        fail("event_id must be unique")
    if len({row["regime_id"] for row in regimes}) != len(regimes):
        fail("regime_id must be unique")
    for index, row in enumerate(regimes):
        if row["end_date"] is not None and row["end_date"] <= row["start_date"]:
            fail(f"invalid regime boundary for {row['regime_id']}")
        if index and regimes[index - 1]["end_date"] is not None and row["start_date"] < regimes[index - 1]["end_date"]:
            fail(f"overlapping regime boundary for {row['regime_id']}")


def validate_parquet_outputs(output_dir: Path, row_sets: Mapping[str, Sequence[Mapping[str, Any]]]) -> None:
    for config_name in CONFIG_NAMES:
        path = output_dir / CONFIG_PATHS[config_name]
        if not path.exists():
            fail(f"missing canonical Parquet output: {path}")
        table = pq.read_table(path)
        expected = arrow_schema(config_name)
        if table.schema.names != expected.names:
            fail(f"{config_name}.parquet columns do not match explicit schema")
        for actual, expected_field in zip(table.schema, expected):
            if actual.type != expected_field.type or actual.nullable != expected_field.nullable:
                fail(f"{config_name}.parquet field {actual.name} does not match explicit Arrow schema")
        if table.num_rows != len(row_sets[config_name]):
            fail(f"{config_name}.parquet row count does not match generated rows")


def build_dataset(input_path: Path = DEFAULT_INPUT, output_dir: Path = DEFAULT_OUTPUT) -> dict[str, Any]:
    try:
        snapshot = json.loads(input_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"could not read SnapshotV2 input {input_path}: {exc}") from exc
    validated = validate_snapshot(snapshot)
    output_dir.mkdir(parents=True, exist_ok=True)
    for subdirectory in ("data", "exports", "schema", "provenance"):
        (output_dir / subdirectory).mkdir(parents=True, exist_ok=True)
    if not all((output_dir / name).exists() for name in ("README.md", "NOTICE.md", "VERSION", "CHANGELOG.md")):
        fail("hf-dataset README.md, NOTICE.md, VERSION, and CHANGELOG.md must exist before building")
    validate_readme_configs(output_dir)
    validate_notice(output_dir)
    version = (output_dir / "VERSION").read_text(encoding="utf-8").strip()
    if version != DATASET_SCHEMA_VERSION:
        fail(f"VERSION must contain dataset schema version {DATASET_SCHEMA_VERSION}")

    decisions = build_decisions(validated)
    annual = build_annual(validated, decisions)
    sources = normalized_sources(validated)
    events = build_events(validated)
    regimes = build_regimes(validated)
    validate_rows(validated, decisions, annual, sources, events, regimes)

    row_sets: dict[str, Sequence[Mapping[str, Any]]] = {
        "decisions": decisions,
        "annual": annual,
        "sources": sources,
        "events": events,
        "regimes": regimes,
    }
    update_readme_build_summary(output_dir, validated, row_sets)
    for config_name, rows in row_sets.items():
        write_parquet(output_dir / CONFIG_PATHS[config_name], rows, config_name)
        write_csv(output_dir / "exports" / f"{config_name}.csv", rows, FIELD_SPECS[config_name])
        if config_name in {"decisions", "annual"}:
            write_jsonl(output_dir / "exports" / f"{config_name}.jsonl", rows, FIELD_SPECS[config_name])
        write_json(output_dir / "schema" / f"{config_name}.schema.json", schema_json(config_name))
    write_json(output_dir / "schema" / "data-dictionary.json", data_dictionary(validated))
    validate_parquet_outputs(output_dir, row_sets)

    generated_at = validated["meta"]["retrievedAt"]
    artifact_files = relative_files(output_dir, exclude={"provenance/build-manifest.json", "SHA256SUMS"})
    output_checksums = {
        path.relative_to(output_dir).as_posix(): sha256_file(path)
        for path in artifact_files
    }
    manifest = {
        "dataset_schema_version": DATASET_SCHEMA_VERSION,
        "generator_version": GENERATOR_VERSION,
        "generated_at": generated_at,
        "source_snapshot_id": validated["meta"]["snapshotId"],
        "source_snapshot_checksum": validated["meta"]["checksum"],
        "source_retrieved_at": generated_at,
        "record_counts_by_config": {config_name: len(rows) for config_name, rows in row_sets.items()},
        "rights": RIGHTS_METADATA,
        "coverage": {
            "earliest_effective_date": decisions[0]["effective_date"].isoformat(),
            "latest_effective_date": decisions[-1]["effective_date"].isoformat(),
        },
        "output_checksums": output_checksums,
    }
    write_json(output_dir / "provenance" / "build-manifest.json", manifest)
    checksum_files = relative_files(output_dir, exclude={"SHA256SUMS"})
    with (output_dir / "SHA256SUMS").open("w", encoding="utf-8", newline="\n") as handle:
        for path in checksum_files:
            handle.write(f"{sha256_file(path)}  {path.relative_to(output_dir).as_posix()}\n")
    validate_output_layout(output_dir)
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="SnapshotV2 JSON input path")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT, help="Dataset artifact directory")
    args = parser.parse_args()
    try:
        manifest = build_dataset(args.input.resolve(), args.output_dir.resolve())
    except (OSError, ValueError, pa.ArrowException) as exc:
        print(f"build-hf-dataset: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({"status": "ok", **manifest}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
