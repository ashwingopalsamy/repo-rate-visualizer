"""Build the US policy-rate snapshot from the Federal Reserve's change tables.

The Fed tables list changes, not every FOMC meeting. Their date column is kept
as a source-record date; no announcement or effective date is inferred from it.
"""

from datetime import date, datetime, timezone
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
import json
import re


ROOT = Path(__file__).resolve().parents[1]
URLS = (
    "https://www.federalreserve.gov/monetarypolicy/openmarket.htm",
    "https://www.federalreserve.gov/monetarypolicy/openmarket_archive.htm",
)


class FedTables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.year = None
        self.heading = False
        self.cell = None
        self.row = None
        self.rows = []
        self.table = False

    def handle_starttag(self, tag, attrs):
        if tag == "h4":
            self.heading = True
            self.heading_text = ""
        elif tag == "table" and self.year is not None:
            self.table = True
        elif tag == "tr" and self.table:
            self.row = []
        elif tag == "td" and self.row is not None:
            self.cell = ""

    def handle_data(self, data):
        if self.heading:
            self.heading_text += data
        if self.cell is not None:
            self.cell += data

    def handle_endtag(self, tag):
        if tag == "h4" and self.heading:
            self.heading = False
            heading = self.heading_text.strip()
            self.year = int(heading) if re.fullmatch(r"20\d\d", heading) else None
        elif tag == "td" and self.cell is not None:
            self.row.append(self.cell.strip())
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if len(self.row) == 4 and 2000 <= (self.year or 0) <= date.today().year:
                self.rows.append((self.year, self.row))
            self.row = None
        elif tag == "table":
            self.table = False


def fetch(url):
    request = Request(url, headers={"User-Agent": "Policy Rate Atlas data builder/1.0"})
    with urlopen(request, timeout=30) as response:
        return response.read()


def main():
    retrieved_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    sources = []
    records = {}
    for index, url in enumerate(URLS):
        content = fetch(url)
        source_id = f"fed-change-table-{index + 1}"
        sources.append({
            "id": source_id,
            "title": "Federal Reserve open-market operations change table" if index == 0 else "Federal Reserve historical open-market operations archive",
            "url": url,
            "retrievedAt": retrieved_at,
            "sha256": sha256(content).hexdigest(),
        })
        parser = FedTables()
        parser.feed(content.decode("utf-8", "replace"))
        for year, cells in parser.rows:
            raw_date, increase, decrease, level = cells
            match = re.match(r"^([A-Za-z]+)\s+(\d{1,2})", raw_date)
            if not match or not re.fullmatch(r"\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?", level):
                continue
            record_date = datetime.strptime(f"{match.group(1)} {match.group(2)} {year}", "%B %d %Y").date().isoformat()
            values = [float(item) for item in re.split(r"\s*[-–]\s*", level)]
            low, high = (values[0], values[-1])
            if not (0 <= low <= high <= 25):
                raise ValueError(f"Unexpected federal funds target: {record_date} {level}")
            change = None
            if re.fullmatch(r"\d+(?:\.\d+)?", increase) and re.fullmatch(r"\d+(?:\.\d+)?", decrease):
                change = round(float(increase) - float(decrease))
            elif increase in ("...", "") and re.fullmatch(r"\d+(?:\.\d+)?", decrease):
                change = -round(float(decrease))
            elif decrease in ("...", "") and re.fullmatch(r"\d+(?:\.\d+)?", increase):
                change = round(float(increase))
            record = {
                "id": f"us-{record_date}",
                "recordDate": record_date,
                "decisionDate": None,
                "effectiveDate": None,
                "recordType": "policy_change",
                "value": {"kind": "range" if len(values) == 2 else "point", "lowBps": round(low * 100), "highBps": round(high * 100)},
                "changeBps": change,
                "sourceIds": [source_id],
            }
            if record_date in records and records[record_date]["value"] != record["value"]:
                raise ValueError(f"Conflicting official rows for {record_date}")
            records[record_date] = record

    ordered = [records[key] for key in sorted(records)]
    if not ordered or ordered[0]["recordDate"] != "2000-02-02":
        raise ValueError("Unexpected start of Federal Reserve history")
    if not any(row["value"]["kind"] == "range" for row in ordered):
        raise ValueError("Federal Reserve target-range transition was not found")
    manifest_path = ROOT / "public" / "data" / "countries" / "manifest.json"
    if manifest_path.exists():
        previous_manifest = json.loads(manifest_path.read_text())
        previous_entry = next((item for item in previous_manifest.get("countries", []) if item.get("code") == "US"), None)
        previous_path = ROOT / "public" / "data" / previous_entry["snapshot"] if previous_entry and previous_entry.get("snapshot") else None
        if previous_path and previous_path.exists():
            previous = json.loads(previous_path.read_text())
            if len(ordered) < len(previous["records"]) or ordered[-1]["recordDate"] < previous["records"][-1]["recordDate"]:
                raise ValueError("Federal Reserve source would shrink the published history")
            if ordered == previous["records"]:
                print("Federal Reserve target-change records unchanged; no release written.")
                return
    sources.append({
        "id": "fed-fomc-statements",
        "title": "Federal Reserve FOMC meeting calendars and statements",
        "url": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
        "retrievedAt": None,
        "sha256": None,
        "role": "Decision-date cross-check; no meeting-level reconciliation claimed",
    })
    snapshot = {
        "schemaVersion": 1,
        "country": "US",
        "centralBank": "Federal Reserve",
        "instrument": "Federal funds target rate or range",
        "frameworks": [
            {"from": "2000-02-02", "to": "2008-12-15", "label": "Target rate"},
            {"from": "2008-12-16", "to": None, "label": "Target range"},
        ],
        "coverage": {"from": ordered[0]["recordDate"], "through": ordered[-1]["recordDate"], "grain": "Published target changes; unchanged meetings are not included"},
        "retrievedAt": retrieved_at,
        "sources": sources,
        "records": ordered,
    }
    payload = json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n"
    digest = sha256(payload.encode()).hexdigest()
    path = ROOT / "public" / "data" / "countries" / "us" / f"{digest}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(payload)
    india_release = re.search(r'"releaseId": "([^"]+)"', (ROOT / "src" / "data" / "releaseMeta.js").read_text()).group(1)
    india_snapshot = json.loads((ROOT / "src" / "data" / "snapshot.json").read_text())
    manifest = {
        "schemaVersion": 1,
        "countries": [
            {"code": "IN", "name": "India", "status": "available", "path": "/", "instrument": "Policy repo rate", "releaseId": india_release, "coverageFrom": india_snapshot["decisions"][0]["date"], "coverageThrough": india_snapshot["decisions"][-1]["date"], "retrievedAt": india_snapshot["meta"]["retrievedAt"]},
            {"code": "US", "name": "United States", "status": "available", "path": "/country/us", "instrument": "Federal funds target rate or range", "releaseId": f"us-{digest}", "snapshot": f"countries/us/{digest}.json", "sha256": digest, "retrievedAt": retrieved_at, "coverageFrom": ordered[0]["recordDate"], "coverageThrough": ordered[-1]["recordDate"]},
            {"code": "GB", "name": "United Kingdom", "status": "planned", "path": None, "instrument": "Bank Rate"},
            {"code": "JP", "name": "Japan", "status": "planned", "path": None, "instrument": "Policy instrument varies by framework"},
            {"code": "TW", "name": "Taiwan", "status": "planned", "path": None, "instrument": "Discount rate"},
        ],
        "ranking": {
            "method": "Nominal GDP with primary-source quality; rollout order is editorial",
            "vintage": "IMF World Economic Outlook, April 2026",
            "year": 2025,
            "unit": "billions of current US dollars",
            "indicator": "NGDPD",
            "sourceUrl": "https://www.imf.org/external/datamapper/api/v1/NGDPD",
            "values": {"US": 30767.075, "JP": 4435.163, "GB": 4003.022, "IN": 3916.312, "TW": 920.05},
        },
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"{len(ordered)} Fed changes; {ordered[0]['recordDate']} to {ordered[-1]['recordDate']}; {digest}")


if __name__ == "__main__":
    main()
