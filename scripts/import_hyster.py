"""Read Hyster XLSX exports; emit whitelisted metrics and card codes, without names.

Usage:
  python scripts/import_hyster.py /path/to/exports --output .data/hyster.json
  python scripts/import_hyster.py /path/to/exports --workforce /path/to/workforceKPITier7.xlsx --output .data/hyster.json

Requires openpyxl (read-only); original workbooks are never modified. Workforce
rows are stored only at their source period granularity; quarterly totals are never
spread across months or days.
"""
import argparse
import hashlib
import json
import math
import re
from datetime import datetime
from pathlib import Path

import openpyxl

FILES = ["assetListing", "DailyFleetUtilization", "utilizationKPITier7",
         "AssetOperatingHistory", "currentFleetStatus", "PMTrackerDW",
         "fuelUsageSummaryequipment", "costOfOperationTier7"]

WORKFORCE_TOTAL_COLUMNS = {
    "serviceHours": 5,
    "driveHours": 8,
    "hydraulicMeterHours": 11,
    "tractionMeterHours": 14,
    "distanceKm": 17,
    "monitoredHours": 20,
    "keyHours": 23,
    "presenceHours": 26,
    "motionHours": 29,
    "hydraulicHours": 32,
    "workHours": 35,
    "liftHours": 38,
    "lowerHours": 41,
    "highSpeedHours": 53,
    "reverseHours": 62,
    "forwardHours": 65,
    "idleHours": 71,
}
MONTHS = {name: i for i, name in enumerate(
    ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"], 1)}


def card_code(value):
    if value is None or value == "":
        return None
    # Strings are never numeric-normalized: text such as 00123 stays 00123.
    if isinstance(value, str):
        return value.strip()
    # Numeric source cells cannot prove whether a leading zero existed in a
    # different system; keep the value seen in this export without padding.
    if isinstance(value, (int, float)) and float(value).is_integer():
        return str(int(value))
    return str(value).strip()


def source_metadata(path, book):
    return {"file": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "sheets": [{"name": s.title, "rows": s.max_row, "state": s.sheet_state} for s in book]}


def non_negative(value):
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) and number >= 0 else None


def parse_workforce_period(text):
    match = re.fullmatch(
        r"\s*(\d{2})\s+([A-Z]{3})\s+(\d{4})\s+\d{2}:\d{2}:\d{2}\s*-\s*"
        r"(\d{2})\s+([A-Z]{3})\s+(\d{4})\s+\d{2}:\d{2}:\d{2}\s*", str(text or ""))
    if not match or match.group(2) not in MONTHS or match.group(5) not in MONTHS:
        raise ValueError("Unsupported Workforce KPI period")
    start = f"{match.group(3)}-{MONTHS[match.group(2)]:02d}-{int(match.group(1)):02d}"
    end = f"{match.group(6)}-{MONTHS[match.group(5)]:02d}-{int(match.group(4)):02d}"
    return start, end


def workforce_metrics(row):
    result = {}
    for key, column in WORKFORCE_TOTAL_COLUMNS.items():
        value = non_negative(row[column])
        if value is not None:
            result[key] = value
    return result


def convert_workforce(path, product_ids, expected_start, expected_end):
    book = openpyxl.load_workbook(path, data_only=True, read_only=True)
    try:
        required = {"Main Page", "Workforce KPI Report"}
        if not required.issubset(book.sheetnames):
            raise ValueError("Unsupported Workforce KPI workbook: required sheets not found")
        main = book["Main Page"]
        report = book["Workforce KPI Report"]
        start, end = parse_workforce_period(main.cell(13, 1).value)
        if (start, end) != (expected_start, expected_end):
            raise ValueError(f"Workforce KPI period {start}..{end} differs from current Hyster period {expected_start}..{expected_end}")
        if str(main.cell(15, 1).value).strip() != "Operator" or str(main.cell(19, 1).value).strip() != "Metric":
            raise ValueError("Unsupported Workforce KPI configuration")
        expected_headers = {
            (1, 4): "Main Service Meter", (1, 16): "Odometer", (1, 22): "Key Switch 'On' Duration",
            (1, 25): "Operator Presence Duration", (1, 28): "Moving Duration",
            (1, 31): "Hydraulic Function Duration", (1, 34): "Working Duration",
            (1, 37): "Lift Duration", (1, 40): "Lower Duration", (1, 52): "High Speed Operation Duration",
            (1, 61): "Reverse Gear Operation Duration", (1, 64): "Forward Gear Operation Duration",
            (1, 70): "Idle Time", (2, 2): "Operator", (2, 3): "Usage Count",
        }
        for (row, col), expected in expected_headers.items():
            if report.cell(row, col).value != expected:
                raise ValueError(f"Unsupported Workforce KPI layout at row {row}, column {col}")
        # Every imported counter is explicitly the source Total Usage column.
        for column in WORKFORCE_TOTAL_COLUMNS.values():
            header = str(report.cell(2, column + 1).value or "")
            if not header.startswith("Total Usage"):
                raise ValueError(f"Unsupported Workforce total column {column + 1}")

        cards, current, by_code, warnings = [], None, {}, []
        for source_row, row in enumerate(report.iter_rows(min_row=3, values_only=True), 3):
            label = row[1] if len(row) > 1 else None
            if label in (None, ""):
                continue
            label = str(label)
            if "Product ID :" in label:
                if current is None:
                    warnings.append(f"Linha {source_row}: equipamento sem cartão pai; registro ignorado")
                    continue
                product = re.search(r"Product ID\s*:\s*(\d+)", label)
                asset_id = product_ids.get(int(product.group(1))) if product else None
                if not asset_id:
                    warnings.append(f"Linha {source_row}: equipamento não conciliado; registro ignorado")
                    continue
                if any(item["assetId"] == asset_id for item in current["assets"]):
                    raise ValueError(f"Duplicate Workforce asset {asset_id} under source row {current['sourceRow']}")
                count = row[2] if len(row) > 2 else None
                if count is None or not float(count).is_integer() or count < 0:
                    raise ValueError(f"Invalid Workforce usage count at row {source_row}")
                current["assets"].append({"assetId": asset_id, "usageCount": int(count),
                                          "metrics": workforce_metrics(row), "sourceRow": source_row})
                continue

            match = re.search(r"\(([^()]*)\)\s*$", label)
            raw_code = match.group(1).strip() if match else None
            code = raw_code if raw_code and re.fullmatch(r"\d{1,64}", raw_code) else None
            quality = "complete" if code else "incomplete"
            if code in by_code:
                quality = "ambiguous"
                for previous in cards:
                    if previous["cardCode"] == code:
                        previous["cardQuality"] = "ambiguous"
            count = row[2] if len(row) > 2 else None
            if count is None or not float(count).is_integer() or count < 0:
                raise ValueError(f"Invalid Workforce usage count at row {source_row}")
            current = {"cardCode": code, "cardQuality": quality, "usageCount": int(count),
                       "metrics": workforce_metrics(row), "assets": [], "sourceRow": source_row}
            cards.append(current)
            if code:
                by_code.setdefault(code, []).append(source_row)
        if not cards:
            raise ValueError("Workforce KPI contains no card rows")
        if any(card["cardQuality"] == "incomplete" for card in cards):
            warnings.append("Há linhas de cartão sem código completo; elas permanecem sem identificação no contrato.")
        if any(card["cardQuality"] == "ambiguous" for card in cards):
            warnings.append("Há códigos de cartão repetidos; as linhas foram sinalizadas como ambíguas e não devem ser agregadas automaticamente.")
        warnings.append("Os contadores Workforce são totais do período da fonte; não foram distribuídos artificialmente por mês ou dia.")
        warnings.append("Linhas filhas por equipamento ficam aninhadas no cartão e não são somadas ao total do cartão como novos registros.")
        return ({"periodStart": start, "periodEnd": end, "granularity": "card-period", "unitSystem": "metric",
                 "sourceFile": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                 "cards": cards, "warnings": warnings}, source_metadata(path, book))
    finally:
        book.close()


def convert(folder, workforce=None):
    books, sources = {}, []
    for name in FILES:
        path = folder / (name + ".xlsx")
        book = openpyxl.load_workbook(path, data_only=True)
        books[name] = [list(sheet.values) for sheet in book]
        sources.append(source_metadata(path, book))
        book.close()
    # Fail closed when the vendor changes column placement; never silently map
    # a different counter into the existing contract.
    headers = [
        ("assetListing", 1, 0, 2, "ID de produto"),
        ("DailyFleetUtilization", 1, 1, 1, "Date"),
        ("DailyFleetUtilization", 1, 2, 2, "Key Time\n(horas)"),
        ("DailyFleetUtilization", 1, 2, 5, "Idle Time\n(horas)"),
        ("utilizationKPITier7", 1, 0, 13, "Interruptor de chave 'Na' duração"),
        ("utilizationKPITier7", 1, 0, 31, "Tempo ocioso"),
        ("AssetOperatingHistory", 1, 0, 17, "Nome do evento"),
        ("currentFleetStatus", 2, 1, 6, "Status"),
        ("fuelUsageSummaryequipment", 1, 0, 10, "Uso total\n(litros)"),
        ("costOfOperationTier7", 1, 0, 11, "Custo total da operação"),
    ]
    for file, sheet, row, col, expected in headers:
        if books[file][sheet][row][col] != expected:
            raise ValueError(f"Unsupported layout: {file}, row {row + 1}, column {col + 1}")
    assets, ids = [], {}
    for r in books["assetListing"][1][1:]:
        alias = "EP" + str(r[5]).zfill(2)
        ids[r[2]] = alias
        assets.append({"assetId": alias, "serviceMeterHours": r[7]})
    daily, seen = [], set()
    asset = None
    for row, r in enumerate(books["DailyFleetUtilization"][1][3:], 4):
        if r[0]:
            asset = ids[int(re.search(r"ID de produto\s*:\s*(\d+)", r[0]).group(1))]
        date = datetime.strptime(r[1], "%m/%d/%Y").date().isoformat()
        if (asset, date) in seen:
            raise ValueError(f"Duplicate daily record at row {row}")
        seen.add((asset, date))
        daily.append(dict(assetId=asset, date=date, keyHours=r[2], presenceHours=r[3],
                          workHours=r[4], idleHours=r[5], waitHours=r[10], sourceRow=row))
    kpi = []
    for row, r in enumerate(books["utilizationKPITier7"][1][2:], 3):
        kpi.append(dict(assetId=ids[r[2]], serviceHours=r[9], monitoredHours=r[12],
                        keyHours=r[15], presenceHours=r[18], motionHours=r[21],
                        hydraulicHours=r[24], workHours=r[27], liftHours=r[30],
                        idleHours=r[33], loadHours=r[36], sourceRow=row))
    events = []
    for row, r in enumerate(books["AssetOperatingHistory"][1][1:], 2):
        events.append(dict(assetId=ids[r[1]], date=r[8].date().isoformat(), time=r[9],
                           type=r[17], cardCode=card_code(r[12]), sourceCritical=r[13] == "Sim", sourceStatus=r[16], sourceRow=row))
    status = [dict(assetId=ids[r[1]], status=r[6], lastAccess=r[9])
              for r in books["currentFleetStatus"][2][2:]]
    fuel = [dict(assetId=ids[r[3]], reportedLiters=r[10])
            for r in books["fuelUsageSummaryequipment"][1][1:]]
    costs = [dict(assetId=ids[r[1]], startHours=r[6], endHours=r[7], intervalHours=r[8],
                  reportedCostPerHour=r[10], reportedTotal=r[11])
             for r in books["costOfOperationTier7"][1][2:]]
    dates = [r["date"] for r in daily]
    operation = str(books["assetListing"][1][1][0])
    result = dict(schemaVersion=2, operationId=hashlib.sha256(operation.encode()).hexdigest()[:16], provider="Hyster Tracker", periodStart=min(dates), periodEnd=max(dates),
                  granularity="asset-day", assets=sorted(assets, key=lambda x: x["assetId"]),
                  daily=daily, kpi=kpi, events=events, currentStatus=status, fuel=fuel, costs=costs,
                  maintenanceAvailable=not any("Nenhum PM" in str(c) for s in books["PMTrackerDW"] for r in s for c in r),
                  sources=sources)
    if workforce:
        result["workforce"], workforce_source = convert_workforce(workforce, ids, result["periodStart"], result["periodEnd"])
        result["sources"].append(workforce_source)
        result["schemaVersion"] = 3
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    parser.add_argument("--output", type=Path, default=Path(".data/hyster.json"))
    parser.add_argument("--legacy", type=Path, help="Optional historical workforce dashboard")
    parser.add_argument("--workforce", type=Path, help="Optional current Workforce KPI export; stored only at source period granularity")
    args = parser.parse_args()
    data = convert(args.folder, args.workforce)
    if args.legacy:
        from import_legacy import convert_legacy
        data["legacy"] = convert_legacy(args.legacy)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"output": str(args.output), "days": len(data["daily"]), "events": len(data["events"]),
                      "workforceCards": len(data.get("workforce", {}).get("cards", []))}))
