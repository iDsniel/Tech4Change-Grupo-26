"""Read Hyster XLSX exports; emit whitelisted metrics and card codes, without names.

Usage: python scripts/import_hyster.py /path/to/exports --output .data/hyster.json
Requires openpyxl (read-only); original workbooks are never modified.
"""
import argparse
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path

import openpyxl

FILES = ["assetListing", "DailyFleetUtilization", "utilizationKPITier7",
         "AssetOperatingHistory", "currentFleetStatus", "PMTrackerDW",
         "fuelUsageSummaryequipment", "costOfOperationTier7"]


def card_code(value):
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)) and float(value).is_integer():
        return str(int(value))
    return str(value).strip()


def convert(folder):
    books, sources = {}, []
    for name in FILES:
        path = folder / (name + ".xlsx")
        book = openpyxl.load_workbook(path, data_only=True)
        books[name] = [list(sheet.values) for sheet in book]
        sources.append({"file": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                        "sheets": [{"name": s.title, "rows": s.max_row, "state": s.sheet_state} for s in book]})
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
    return dict(schemaVersion=2, operationId=hashlib.sha256(operation.encode()).hexdigest()[:16], provider="Hyster Tracker", periodStart=min(dates), periodEnd=max(dates),
                granularity="asset-day", assets=sorted(assets, key=lambda x: x["assetId"]),
                daily=daily, kpi=kpi, events=events, currentStatus=status, fuel=fuel, costs=costs,
                maintenanceAvailable=not any("Nenhum PM" in str(c) for s in books["PMTrackerDW"] for r in s for c in r),
                sources=sources)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    parser.add_argument("--output", type=Path, default=Path(".data/hyster.json"))
    parser.add_argument("--legacy", type=Path, help="Optional historical workforce dashboard")
    args = parser.parse_args()
    data = convert(args.folder)
    if args.legacy:
        from import_legacy import convert_legacy
        data["legacy"] = convert_legacy(args.legacy)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"output": str(args.output), "days": len(data["daily"]), "events": len(data["events"])}))
