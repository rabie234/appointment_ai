"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { DAYS, type DayHours } from "@/lib/schedule"

/**
 * A 7-row editor for a weekly schedule. Renders hidden/real form fields named
 * `${prefix}-<Day>-{open,close,off}` so the matching `weekFromFormData(fd,
 * prefix)` on the server reads them back. Used for both clinic and doctor hours.
 */
export function WeekEditor({
    prefix,
    initial,
    closedLabel = "Closed",
}: {
    prefix: string
    initial: DayHours[]
    closedLabel?: string
}) {
    const byDay = new Map(initial.map((d) => [d.day, d]))
    const [week, setWeek] = useState<DayHours[]>(
        DAYS.map((day) => byDay.get(day) ?? { day, open: "09:00", close: "17:00", closed: false })
    )

    function patch(day: string, changes: Partial<DayHours>) {
        setWeek((prev) => prev.map((d) => (d.day === day ? { ...d, ...changes } : d)))
    }

    return (
        <div className="rounded-lg border divide-y">
            {week.map((d) => (
                <div
                    key={d.day}
                    className={cn(
                        "grid grid-cols-[7rem_1fr_auto] items-center gap-3 px-4 py-3 transition-colors",
                        d.closed && "bg-muted/40"
                    )}
                >
                    <span className="text-sm font-semibold">{d.day}</span>

                    {d.closed ? (
                        <span className="text-sm text-muted-foreground italic">{closedLabel}</span>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Input
                                type="time"
                                value={d.open}
                                onChange={(e) => patch(d.day, { open: e.target.value })}
                                className="h-9 w-32"
                                aria-label={`${d.day} open`}
                            />
                            <span className="text-muted-foreground">–</span>
                            <Input
                                type="time"
                                value={d.close}
                                onChange={(e) => patch(d.day, { close: e.target.value })}
                                className="h-9 w-32"
                                aria-label={`${d.day} close`}
                            />
                        </div>
                    )}

                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer justify-self-end">
                        <input
                            type="checkbox"
                            checked={d.closed}
                            onChange={(e) => patch(d.day, { closed: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        {closedLabel}
                    </label>

                    {/* Hidden fields carry the current state into the server action. */}
                    <input type="hidden" name={`${prefix}-${d.day}-open`} value={d.open} />
                    <input type="hidden" name={`${prefix}-${d.day}-close`} value={d.close} />
                    {d.closed && <input type="hidden" name={`${prefix}-${d.day}-off`} value="on" />}
                </div>
            ))}
        </div>
    )
}
