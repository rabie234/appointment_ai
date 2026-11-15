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
        // A rolling year starts on the same calendar date one year earlier.
        // Clamp leap-day/month-end dates to the final valid day in that month.
        const year = today.getUTCFullYear() - 1
        const month = today.getUTCMonth()
        const day = Math.min(
            today.getUTCDate(),
            new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
        )
        const start = new Date(Date.UTC(year, month, day))
        const duration = end.getTime() - start.getTime()

        return {
            ...range,
            start,
            end,
            prevStart: new Date(start.getTime() - duration),
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
