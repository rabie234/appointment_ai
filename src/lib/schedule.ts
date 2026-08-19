/**
 * Shared vocabulary for clinic + doctor scheduling. Kept dependency-free so it
 * can be imported from server actions, models, and client components alike.
 *
 * Every schedule is a fixed 7-entry array, one per weekday, in DAYS order.
 * Times are stored as "HH:MM" 24-hour strings; an empty/closed day carries the
 * flag rather than relying on blank times.
 */

export const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type Day = (typeof DAYS)[number];

/** One day's window. `closed` (clinic) / `off` (doctor) means not working. */
export interface DayHours {
  day: Day;
  open: string; // "HH:MM"
  close: string; // "HH:MM"
  closed: boolean;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** Minutes since midnight, for ordering/containment checks. NaN if malformed. */
export function toMinutes(time: string): number {
  if (!isValidTime(time)) return NaN;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** A sensible default week: Mon–Fri 09:00–17:00, weekend closed. */
export function defaultWeek(): DayHours[] {
  return DAYS.map((day) => ({
    day,
    open: '09:00',
    close: '17:00',
    closed: day === 'Saturday' || day === 'Sunday',
  }));
}

/**
 * Coerce arbitrary stored/submitted data into a complete, ordered week.
 * Missing days fall back to the default; unknown extra entries are dropped.
 * This keeps callers from ever having to reason about a partial schedule.
 */
export function normalizeWeek(input: unknown): DayHours[] {
  const byDay = new Map<string, Partial<DayHours>>();
  if (Array.isArray(input)) {
    for (const entry of input) {
      if (entry && typeof entry === 'object' && 'day' in entry) {
        byDay.set(String((entry as DayHours).day), entry as Partial<DayHours>);
      }
    }
  }

  const fallback = defaultWeek();
  return DAYS.map((day, i) => {
    const src = byDay.get(day) ?? {};
    const open = typeof src.open === 'string' && isValidTime(src.open) ? src.open : fallback[i].open;
    const close = typeof src.close === 'string' && isValidTime(src.close) ? src.close : fallback[i].close;
    const closed = Boolean(src.closed);
    return { day, open, close, closed };
  });
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/** An open day must have open < close. Closed days are always fine. */
export function validateDay(entry: DayHours): ValidationResult {
  if (entry.closed) return { ok: true };
  if (!isValidTime(entry.open) || !isValidTime(entry.close)) {
    return { ok: false, error: `${entry.day}: invalid time` };
  }
  if (toMinutes(entry.open) >= toMinutes(entry.close)) {
    return { ok: false, error: `${entry.day}: opening time must be before closing time` };
  }
  return { ok: true };
}

export function validateWeek(week: DayHours[]): ValidationResult {
  for (const entry of week) {
    const res = validateDay(entry);
    if (!res.ok) return res;
  }
  return { ok: true };
}

/**
 * Check a doctor's week against the clinic's open hours. A doctor may only work
 * on days the clinic is open, and within (or equal to) the clinic's window.
 */
export function validateAgainstClinic(
  doctor: DayHours[],
  clinic: DayHours[]
): ValidationResult {
  const clinicByDay = new Map(clinic.map((c) => [c.day, c]));

  for (const d of doctor) {
    if (d.closed) continue;

    const c = clinicByDay.get(d.day);
    if (!c || c.closed) {
      return { ok: false, error: `${d.day}: the clinic is closed on this day` };
    }
    if (toMinutes(d.open) < toMinutes(c.open) || toMinutes(d.close) > toMinutes(c.close)) {
      return {
        ok: false,
        error: `${d.day}: hours must fall within the clinic window (${c.open}–${c.close})`,
      };
    }
  }
  return { ok: true };
}

/** Default appointment slot length, in minutes. */
export const SLOT_MINUTES = 30;

/** The weekday name (in DAYS form) for a given date. */
export function dayOfWeek(date: Date): Day {
  // JS getDay(): 0 = Sunday … 6 = Saturday. DAYS starts on Monday.
  const map: Day[] = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return map[date.getDay()];
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * All slot start times ("HH:MM") for one day's working window, stepping by
 * `step` minutes. A slot is only emitted if a full `step` fits before close, so
 * a 09:00–09:20 window yields nothing at a 30-min step. Closed days yield [].
 */
export function slotsForDay(entry: DayHours, step: number = SLOT_MINUTES): string[] {
  if (entry.closed) return [];
  const start = toMinutes(entry.open);
  const end = toMinutes(entry.close);
  if (Number.isNaN(start) || Number.isNaN(end) || start >= end) return [];

  const slots: string[] = [];
  for (let t = start; t + step <= end; t += step) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

/**
 * Free slots for a doctor on the weekday of `date`: every slot the doctor's
 * schedule allows, minus the ones already taken. `taken` is a set of "HH:MM".
 */
export function availableSlots(
  schedule: DayHours[],
  date: Date,
  taken: Set<string>,
  step: number = SLOT_MINUTES
): string[] {
  const day = dayOfWeek(date);
  const entry = schedule.find((s) => s.day === day);
  if (!entry) return [];
  return slotsForDay(entry, step).filter((slot) => !taken.has(slot));
}

/** Read a submitted week out of FormData using `${prefix}-<day>-{open,close,off}`. */
export function weekFromFormData(formData: FormData, prefix: string): DayHours[] {
  return DAYS.map((day) => {
    const closed = formData.get(`${prefix}-${day}-off`) === 'on';
    const open = String(formData.get(`${prefix}-${day}-open`) ?? '09:00');
    const close = String(formData.get(`${prefix}-${day}-close`) ?? '17:00');
    return { day, open, close, closed };
  });
}
