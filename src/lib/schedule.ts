/**
 * Shared schedule utilities for clinic and doctor working hours.
 * A day may contain multiple intervals. `open` and `close` remain for
 * compatibility with older records and components.
 */

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type Day = (typeof DAYS)[number];

export interface TimeInterval {
  open: string;
  close: string;
}

export interface DayHours {
  day: Day;
  open: string;
  close: string;
  closed: boolean;
  intervals?: TimeInterval[];
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function toMinutes(time: string): number {
  if (!isValidTime(time)) return Number.NaN;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function normalizeIntervals(input: unknown): TimeInterval[] {
  if (!Array.isArray(input)) return [];

  const valid = input
    .filter(
      (item): item is TimeInterval =>
        Boolean(
          item &&
            typeof item === "object" &&
            "open" in item &&
            "close" in item &&
            typeof (item as TimeInterval).open === "string" &&
            typeof (item as TimeInterval).close === "string" &&
            isValidTime((item as TimeInterval).open) &&
            isValidTime((item as TimeInterval).close) &&
            toMinutes((item as TimeInterval).open) <
              toMinutes((item as TimeInterval).close)
        )
    )
    .map((item) => ({ open: item.open, close: item.close }))
    .sort((left, right) => toMinutes(left.open) - toMinutes(right.open));

  const merged: TimeInterval[] = [];

  for (const current of valid) {
    const previous = merged[merged.length - 1];

    if (!previous || toMinutes(current.open) > toMinutes(previous.close)) {
      merged.push({ ...current });
      continue;
    }

    if (toMinutes(current.close) > toMinutes(previous.close)) {
      previous.close = current.close;
    }
  }

  return merged;
}

/** Gets stored intervals, including saved intervals on an Off day. */
function storedIntervals(entry: DayHours): TimeInterval[] {
  if (Array.isArray(entry.intervals)) {
    const intervals = normalizeIntervals(entry.intervals);

    if (intervals.length > 0) return intervals;
  }

  // Recover older records that only stored open/close.
  if (
    isValidTime(entry.open) &&
    isValidTime(entry.close) &&
    toMinutes(entry.open) < toMinutes(entry.close)
  ) {
    return [{ open: entry.open, close: entry.close }];
  }

  return [];
}

/** Gets working intervals; an Off day has no active intervals. */
export function intervalsForDay(entry: DayHours): TimeInterval[] {
  return entry.closed ? [] : storedIntervals(entry);
}

export function defaultWeek(): DayHours[] {
  return DAYS.map((day) => {
    const closed = day === "Saturday" || day === "Sunday";

    return {
      day,
      open: "09:00",
      close: "17:00",
      closed,
      intervals: closed ? [] : [{ open: "09:00", close: "17:00" }],
    };
  });
}

/** Converts saved schedules, including older one-range records, into a full week. */
export function normalizeWeek(input: unknown): DayHours[] {
  const byDay = new Map<string, Record<string, unknown>>();

  if (Array.isArray(input)) {
    for (const entry of input) {
      if (entry && typeof entry === "object" && "day" in entry) {
        const record = entry as Record<string, unknown>;
        byDay.set(String(record.day), record);
      }
    }
  }

  const fallback = defaultWeek();

  return DAYS.map((day, index) => {
    const source = byDay.get(day);
    if (!source) return fallback[index];

    const open =
      typeof source.open === "string" && isValidTime(source.open)
        ? source.open
        : fallback[index].open;

    const close =
      typeof source.close === "string" && isValidTime(source.close)
        ? source.close
        : fallback[index].close;

    let intervals = Array.isArray(source.intervals)
      ? normalizeIntervals(source.intervals)
      : [];

    // Retain legacy hours on an Off day so reopening it does not lose its
    // previous working-time range.
    if (intervals.length === 0) {
      intervals = normalizeIntervals([{ open, close }]);
    }

    const first = intervals[0];
    const last = intervals[intervals.length - 1];

    return {
      day,
      open: first?.open ?? open,
      close: last?.close ?? close,
      closed: Boolean(source.closed) || intervals.length === 0,
      intervals,
    };
  });
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validateDay(entry: DayHours): ValidationResult {
  if (entry.closed) return { ok: true };

  const rawIntervals = Array.isArray(entry.intervals)
    ? entry.intervals
    : [{ open: entry.open, close: entry.close }];

  if (rawIntervals.length === 0) {
    return {
      ok: false,
      error: `${entry.day}: add at least one working time or mark the day off`,
    };
  }

  const intervals: TimeInterval[] = [];

  for (const interval of rawIntervals) {
    if (
      !interval ||
      typeof interval.open !== "string" ||
      typeof interval.close !== "string" ||
      !isValidTime(interval.open) ||
      !isValidTime(interval.close)
    ) {
      return { ok: false, error: `${entry.day}: invalid time` };
    }

    if (toMinutes(interval.open) >= toMinutes(interval.close)) {
      return {
        ok: false,
        error: `${entry.day}: each opening time must be before its closing time`,
      };
    }

    intervals.push({ open: interval.open, close: interval.close });
  }

  intervals.sort((left, right) => toMinutes(left.open) - toMinutes(right.open));

  for (let index = 1; index < intervals.length; index += 1) {
    if (
      toMinutes(intervals[index].open) <
      toMinutes(intervals[index - 1].close)
    ) {
      return {
        ok: false,
        error: `${entry.day}: working time ranges must not overlap`,
      };
    }
  }

  return { ok: true };
}

export function validateWeek(week: DayHours[]): ValidationResult {
  for (const entry of week) {
    const result = validateDay(entry);
    if (!result.ok) return result;
  }

  return { ok: true };
}

export function validateAgainstClinic(
  doctor: DayHours[],
  clinic: DayHours[]
): ValidationResult {
  const clinicByDay = new Map(clinic.map((entry) => [entry.day, entry]));

  for (const doctorDay of doctor) {
    if (doctorDay.closed) continue;

    const clinicDay = clinicByDay.get(doctorDay.day);
    const doctorIntervals = intervalsForDay(doctorDay);

    if (!clinicDay || clinicDay.closed) {
      return {
        ok: false,
        error: `${doctorDay.day}: the clinic is closed on this day`,
      };
    }

    for (const doctorInterval of doctorIntervals) {
      const fitsClinicInterval = intervalsForDay(clinicDay).some(
        (clinicInterval) =>
          toMinutes(doctorInterval.open) >= toMinutes(clinicInterval.open) &&
          toMinutes(doctorInterval.close) <= toMinutes(clinicInterval.close)
      );

      if (!fitsClinicInterval) {
        return {
          ok: false,
          error: `${doctorDay.day}: every doctor time range must fall within clinic opening hours`,
        };
      }
    }
  }

  return { ok: true };
}

/** Patient hours are the overlap; a closed day retains its saved ranges invisibly. */
export function intersectSchedules(
  doctorSchedule: DayHours[],
  clinicSchedule: DayHours[]
): DayHours[] {
  const clinicByDay = new Map(clinicSchedule.map((entry) => [entry.day, entry]));

  return doctorSchedule.map((doctorDay) => {
    const clinicDay = clinicByDay.get(doctorDay.day);
    const savedDoctorIntervals = storedIntervals(doctorDay);

    if (doctorDay.closed || !clinicDay || clinicDay.closed) {
      return {
        ...doctorDay,
        closed: true,
        intervals: savedDoctorIntervals,
      };
    }

    const intersections: TimeInterval[] = [];

    for (const doctorInterval of intervalsForDay(doctorDay)) {
      for (const clinicInterval of intervalsForDay(clinicDay)) {
        const start = Math.max(
          toMinutes(doctorInterval.open),
          toMinutes(clinicInterval.open)
        );
        const end = Math.min(
          toMinutes(doctorInterval.close),
          toMinutes(clinicInterval.close)
        );

        if (start < end) {
          intersections.push({
            open: minutesToTime(start),
            close: minutesToTime(end),
          });
        }
      }
    }

    const intervals = normalizeIntervals(intersections);
    const first = intervals[0];
    const last = intervals[intervals.length - 1];

    return {
      ...doctorDay,
      open: first?.open ?? doctorDay.open,
      close: last?.close ?? doctorDay.close,
      closed: intervals.length === 0,
      intervals: intervals.length > 0 ? intervals : savedDoctorIntervals,
    };
  });
}

export const SLOT_MINUTES = 30;

export function dayOfWeek(date: Date): Day {
  const map: Day[] = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return map[date.getDay()];
}

export function slotEnd(
  start: string,
  step: number = SLOT_MINUTES
): string {
  const minutes = toMinutes(start);
  if (Number.isNaN(minutes)) return start;
  return minutesToTime(minutes + step);
}

export function slotsForDay(
  entry: DayHours,
  step: number = SLOT_MINUTES
): string[] {
  if (entry.closed || !Number.isFinite(step) || step <= 0) return [];

  const slots: string[] = [];

  for (const interval of intervalsForDay(entry)) {
    const start = toMinutes(interval.open);
    const end = toMinutes(interval.close);

    for (let time = start; time + step <= end; time += step) {
      slots.push(minutesToTime(time));
    }
  }

  return [...new Set(slots)].sort(
    (left, right) => toMinutes(left) - toMinutes(right)
  );
}

export function availableSlots(
  schedule: DayHours[],
  date: Date,
  taken: Set<string>,
  step: number = SLOT_MINUTES
): string[] {
  const day = dayOfWeek(date);
  const entry = schedule.find((item) => item.day === day);

  if (!entry) return [];

  return slotsForDay(entry, step).filter((slot) => !taken.has(slot));
}

/**
 * Reads both new multi-interval fields and older one-range fields.
 * An Off day keeps its intervals so reopening it restores its previous ranges.
 */
export function weekFromFormData(
  formData: FormData,
  prefix: string
): DayHours[] {
  return DAYS.map((day) => {
    const closed = formData.get(`${prefix}-${day}-off`) === "on";
    const countValue = formData.get(`${prefix}-${day}-interval-count`);
    const legacyOpen = String(
      formData.get(`${prefix}-${day}-open`) ?? "09:00"
    );
    const legacyClose = String(
      formData.get(`${prefix}-${day}-close`) ?? "17:00"
    );

    let intervals: TimeInterval[];

    if (countValue !== null) {
      const count = Number(countValue);
      const safeCount =
        Number.isInteger(count) && count >= 0 && count <= 8 ? count : 0;

      intervals = [];

      for (let index = 0; index < safeCount; index += 1) {
        intervals.push({
          open: String(
            formData.get(`${prefix}-${day}-interval-${index}-open`) ?? ""
          ),
          close: String(
            formData.get(`${prefix}-${day}-interval-${index}-close`) ?? ""
          ),
        });
      }
    } else {
      intervals = [{ open: legacyOpen, close: legacyClose }];
    }

    return {
      day,
      open: intervals[0]?.open ?? legacyOpen,
      close: intervals[intervals.length - 1]?.close ?? legacyClose,
      closed,
      intervals,
    };
  });
}
