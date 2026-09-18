export type OperationalShiftCode = "A" | "B" | "C";

export const currentOperationProfile = {
  source: "configured-current-operation",
  primaryMaterialFlow: "pallets de hardboard",
  fleetAlsoUsedByMaintenance: true,
  shifts: [
    { code: "A" as const, start: "07:00", end: "15:00" },
    { code: "B" as const, start: "15:00", end: "23:00" },
    { code: "C" as const, start: "23:00", end: "07:00" }
  ],
  safety: {
    reverseTravelPreferred: true,
    speedIsRelevant: true
  }
} as const;

export function operationalShiftForTime(value: string | null | undefined): OperationalShiftCode | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const total = hour * 60 + minute;
  if (total >= 7 * 60 && total < 15 * 60) return "A";
  if (total >= 15 * 60 && total < 23 * 60) return "B";
  return "C";
}
