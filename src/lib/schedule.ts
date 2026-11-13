/**
 * Shared schedule utilities for clinic and doctor working hours.
 *
 * A day can contain one or more intervals. The `open` and `close` fields
 * remain for compatibility with existing parts of the app; when `intervals`
 * is present, it is the source of truth.
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

/** Minutes after midnight. Returns NaN for malformed values. */
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

/**
 * Sorts valid intervals and joins intervals that overlap or touch.
 * Invalid intervals are discarded when normalizing stored data.
 */
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
    .sort((a, b) => toMinutes(a.open) - toMinutes(b.open));

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

/**
 * Returns a day's intervals. Supports old records that only have `open`
 * and `close`, as well as new records with `intervals`.
 */
export function intervalsForDay(entry: DayHours): TimeInterval[] {
  if (entry.closed) return [];

  if (Array.isArray(entry.intervals)) {
    return normalizeIntervals(entry.intervals);
  }

  if (
    isValidTime(entry.open) &&
    isValidTime(entry.close) &&
    toMinutes(entry.open) < toMinutes(entry.close)
  ) {
    return [{ open: entry.open, close: entry.close }];
  }

  return [];
}

/** Monday–Friday 09:00–17:00, with Saturday and Sunday closed. */
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

/**
 * Coerces stored data into a complete, ordered week.
 * Old one-interval records are converted into the new interval format.
 */
export function normalizeWeek(input: unknown): DayHours[] {
  const byDay = new Map<string, Record<string, unknown>>();

  if (Array.isArray(input)) {
    for (const entry of input) {
      if (
        entry &&
        typeof entry === "object" &&
        "day" in entry
      ) {
        const record = entry as Record<string, unknown>;
        byDay.set(String(record.day), record);
      }
    }
  }

  const fallback = defaultWeek();

  return DAYS.map((day, index) => {
    const source = byDay.get(day);
    if (!source) return fallback[index];

    const sourceOpen =
      typeof source.open === "string" && isValidTime(source.open)
        ? source.open
        : fallback[index].open;

    const sourceClose =
      typeof source.close === "string" && isValidTime(source.close)
        ? source.close
        : fallback[index].close;

    const explicitlyClosed = Boolean(source.closed);

    const intervals = explicitlyClosed
      ? []
      : Array.isArray(source.intervals)
        ? normalizeIntervals(source.intervals)
        : normalizeIntervals([{ open: sourceOpen, close: sourceClose }]);

    const first = intervals[0];
    const last = intervals[intervals.length - 1];

    return {
      day,
      open: first?.open ?? sourceOpen,
      close: last?.close ?? sourceClose,
      closed: explicitlyClosed || intervals.length === 0,
      intervals,
    };
  });
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/** Validates one day's intervals, including overlaps. */
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

  for (const item of rawIntervals) {
    if (
      !item ||
      typeof item.open !== "string" ||
      typeof item.close !== "string" ||
      !isValidTime(item.open) ||
      !isValidTime(item.close)
    ) {
      return { ok: false, error: `${entry.day}: invalid time` };
    }

    if (toMinutes(item.open) >= toMinutes(item.close)) {
      return {
        ok: false,
        error: `${entry.day}: each opening time must be before its closing time`,
      };
    }

    intervals.push({ open: item.open, close: item.close });
  }

  intervals.sort((a, b) => toMinutes(a.open) - toMinutes(b.open));

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

/**
 * Each doctor interval must fit completely inside one clinic interval.
 * A doctor's interval cannot cross a clinic break.
 */
export function validateAgainstClinic(
  doctor: DayHours[],
  clinic: DayHours[]
): ValidationResult {
  const clinicByDay = new Map(clinic.map((entry) => [entry.day, entry]));

  for (const doctorDay of doctor) {
    if (doctorDay.closed) continue;

    const clinicDay = clinicByDay.get(doctorDay.day);
    const doctorIntervals = intervalsForDay(doctorDay);

    if (!doctorIntervals.length) {
      return {
        ok: false,
        error: `${doctorDay.day}: add working hours or mark the day off`,
      };
    }

    if (!clinicDay || clinicDay.closed) {
      return {
        ok: false,
        error: `${doctorDay.day}: the clinic is closed on this day`,
      };
    }

    const clinicIntervals = intervalsForDay(clinicDay);

    for (const doctorInterval of doctorIntervals) {
      const fitsClinicInterval = clinicIntervals.some(
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

/**
 * Calculates patient-facing hours by intersecting the doctor's schedule
 * with clinic hours. It never expands the doctor's saved hours.
 */
export function intersectSchedules(
  doctorSchedule: DayHours[],
  clinicSchedule: DayHours[]
): DayHours[] {
  const clinicByDay = new Map(clinicSchedule.map((entry) => [entry.day, entry]));

  return doctorSchedule.map((doctorDay) => {
    const clinicDay = clinicByDay.get(doctorDay.day);

    if (doctorDay.closed || !clinicDay || clinicDay.closed) {
      return {
        ...doctorDay,
        closed: true,
        intervals: [],
      };
    }

    const doctorIntervals = intervalsForDay(doctorDay);
    const clinicIntervals = intervalsForDay(clinicDay);
    const intersections: TimeInterval[] = [];

    for (const doctorInterval of doctorIntervals) {
      for (const clinicInterval of clinicIntervals) {
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
      intervals,
    };
  });
}

/** Default appointment slot length. */
export const SLOT_MINUTES = 30;

/** Weekday name for a date. */
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

/** End time of a slot that starts at `start`. */
export function slotEnd(
  start: string,
  step: number = SLOT_MINUTES
): string {
  const minutes = toMinutes(start);
  if (Number.isNaN(minutes)) return start;

  return minutesToTime(minutes + step);
}

/** Slots that fit fully inside any of this day's working intervals. */
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
    (a, b) => toMinutes(a) - toMinutes(b)
  );
}

/** Free slots for a doctor on the weekday of `date`. */
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
 * Reads a week from FormData.
 *
 * New interval field names:
 *   `${prefix}-${day}-interval-count`
 *   `${prefix}-${day}-interval-${index}-open`
 *   `${prefix}-${day}-interval-${index}-close`
 *
 * Falls back to the old one-range field names for existing forms.
 */
export function weekFromFormData(
  formData: FormData,
  prefix: string
): DayHours[] {
  return DAYS.map((day) => {
    const closed = formData.get(`${prefix}-${day}-off`) === "on";
    const countValue = formData.get(`${prefix}-${day}-interval-count`);

    if (closed) {
      return {
        day,
        open: "09:00",
        close: "17:00",
        closed: true,
        intervals: [],
      };
    }

    if (countValue !== null) {
      const count = Number(countValue);
      const safeCount =
        Number.isInteger(count) && count >= 0 && count <= 8 ? count : 0;

      const intervals: TimeInterval[] = [];

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

      return {
        day,
        open: intervals[0]?.open ?? "09:00",
        close: intervals[intervals.length - 1]?.close ?? "17:00",
        closed: false,
        intervals,
      };
    }

    const open = String(
      formData.get(`${prefix}-${day}-open`) ?? "09:00"
    );
    const close = String(
      formData.get(`${prefix}-${day}-close`) ?? "17:00"
    );

    return {
      day,
      open,
      close,
      closed: false,
      intervals: [{ open, close }],
    };
  });
}