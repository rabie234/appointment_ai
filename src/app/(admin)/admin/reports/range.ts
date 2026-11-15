/**
 * Report date ranges, shared by the reports page and its CSV export so both
 * always cover exactly the same slice of appointments.
 *
 * Appointment dates are stored as UTC midnight, so every bound here is a UTC
 * midnight too. A range always ends at the end of today and runs backwards; the
 * comparison period is the same length immediately before it.
 */

const DAY_MS = 24 * 60 * 60 * 1000

export type Bucket = "day" | "week" | "month"

export const RANGES = [
    { key: "7d", label: "Last 7 days", bucket: "day" },
    { key: "30d", label: "Last 30 days", bucket: "day" },
    { key: "90d", label: "Last 90 days", bucket: "week" },
    { key: "12m", label: "Last 12 months", bucket: "month" },
] as const satisfies readonly { key: string; label: string; bucket: Bucket }[]

export type RangeKey = (typeof RANGES)[number]["key"]

export const DEFAULT_RANGE: RangeKey = "30d"

export type ResolvedRange = {
    key: RangeKey
    label: string
    bucket: Bucket
    /** Inclusive start of the reported period. */
    start: Date
    /** Exclusive end — tomorrow's UTC midnight, so today is included. */
    end: Date
    /** Inclusive start of the comparison period, which ends at `start`. */
    prevStart: Date
    /** How the comparison period is named in the UI, e.g. "previous 30 days". */
    prevLabel: string
}

export function resolveRange(key: string | undefined, now: Date = new Date()): ResolvedRange {
    const range = RANGES.find((r) => r.key === key) ?? RANGES.find((r) => r.key === DEFAULT_RANGE)!

    const today = new Date(now)
    today.setUTCHours(0, 0, 0, 0)
    const end = new Date(today.getTime() + DAY_MS)

    if (range.key === "12m") {
        // Whole calendar months, so monthly buckets are never partial at the start.
        const y = today.getUTCFullYear()
        const m = today.getUTCMonth()
        return {
            ...range,
            start: new Date(Date.UTC(y, m - 11, 1)),
            end,
            prevStart: new Date(Date.UTC(y, m - 23, 1)),
            prevLabel: "previous 12 months",
        }
    }

    const days = Number.parseInt(range.key, 10)
    const start = new Date(end.getTime() - days * DAY_MS)
    return {
        ...range,
        start,
        end,
        prevStart: new Date(start.getTime() - days * DAY_MS),
        prevLabel: `previous ${days} days`,
    }
}
