
"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { DAYS, type DayHours } from "@/lib/schedule"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"

export function WeekEditor({
    prefix,
    initial,
    closedLabel,
}: {
    prefix: string
    initial: DayHours[]
    closedLabel?: string
}) {
    const { language } = useLanguage()

    const translatedClosedLabel = closedLabel
        ? t(language, closedLabel)
        : t(language, "Closed")

    const byDay = new Map(initial.map((d) => [d.day, d]))

    const [week, setWeek] = useState<DayHours[]>(
        DAYS.map(
            (day) =>
                byDay.get(day) ?? {
                    day,
                    open: "09:00",
                    close: "17:00",
                    closed: false,
                }
        )
    )

    function patch(day: string, changes: Partial<DayHours>) {
        setWeek((prev) =>
            prev.map((d) => (d.day === day ? { ...d, ...changes } : d))
        )
    }

    return (
        <div
            className="rounded-lg border divide-y"
            dir={language === "ar" ? "rtl" : "ltr"}
        >
            {week.map((d) => (
                <div
                    key={d.day}
                    className={cn(
                        "grid grid-cols-[7rem_1fr_auto] items-center gap-3 px-4 py-3 transition-colors",
                        d.closed && "bg-muted/40"
                    )}
                >
                    <span className="text-sm font-semibold">
                        {t(language, d.day)}
                    </span>

                    {d.closed ? (
                        <span className="text-sm text-muted-foreground italic">
                            {translatedClosedLabel}
                        </span>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Input
                                type="time"
                                value={d.open}
                                onChange={(e) =>
                                    patch(d.day, { open: e.target.value })
                                }
                                className="h-9 w-32"
                                aria-label={`${t(language, d.day)} - ${t(language, "Open")}`}
                            />

                            <span className="text-muted-foreground">–</span>

                            <Input
                                type="time"
                                value={d.close}
                                onChange={(e) =>
                                    patch(d.day, { close: e.target.value })
                                }
                                className="h-9 w-32"
                                aria-label={`${t(language, d.day)} - ${t(language, "Close")}`}
                            />
                        </div>
                    )}

                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer justify-self-end">
                        <input
                            type="checkbox"
                            checked={d.closed}
                            onChange={(e) =>
                                patch(d.day, { closed: e.target.checked })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        {translatedClosedLabel}
                    </label>

                    {/* Keep the original field names for the server action. */}
                    <input
                        type="hidden"
                        name={`${prefix}-${d.day}-open`}
                        value={d.open}
                    />
                    <input
                        type="hidden"
                        name={`${prefix}-${d.day}-close`}
                        value={d.close}
                    />
                    {d.closed && (
                        <input
                            type="hidden"
                            name={`${prefix}-${d.day}-off`}
                            value="on"
                        />
                    )}
                </div>
            ))}
        </div>
    )
}
