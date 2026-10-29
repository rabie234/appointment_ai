
"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

export type OutcomeBucket = {
    key: string
    label: string
    fullLabel: string
    completed: number
    missed: number
    cancelled: number
    scheduled: number
}

const OUTCOMES = [
    { key: "completed", label: "Completed", fill: "bg-series-1" },
    { key: "missed", label: "Missed", fill: "bg-series-2" },
    { key: "cancelled", label: "Cancelled", fill: "bg-series-3" },
    { key: "scheduled", label: "Scheduled", fill: "bg-series-4" },
] as const

const MAX_CAP_LABELS = 13
const AXIS_LABEL_PX = 48
const DEFAULT_PLOT_PX = 640
const TOOLTIP_PX = 176

function total(b: OutcomeBucket): number {
    return b.completed + b.missed + b.cancelled + b.scheduled
}

function niceTicks(max: number): number[] {
    if (max <= 0) return [0, 1]

    const rough = max / 4
    const pow = 10 ** Math.floor(Math.log10(rough))
    const step = Math.max(
        1,
        [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? pow * 10
    )
    const top = Math.ceil(max / step) * step
    const ticks: number[] = []

    for (let v = 0; v <= top; v += step) {
        ticks.push(v)
    }

    return ticks
}

export function OutcomesChart({
    buckets,
}: {
    buckets: OutcomeBucket[]
}) {
    const { language } = useLanguage()

    const [active, setActive] = useState<number | null>(null)
    const [plotWidth, setPlotWidth] = useState(DEFAULT_PLOT_PX)
    const plotRef = useRef<HTMLDivElement>(null)

    const hasData = buckets.some((b) => total(b) > 0)

    const translatedOutcomes = OUTCOMES.map((outcome) => ({
        ...outcome,
        translatedLabel: t(language, outcome.label),
    }))

    useEffect(() => {
        const el = plotRef.current
        if (!el) return

        const observer = new ResizeObserver(([entry]) => {
            setPlotWidth(entry.contentRect.width)
        })

        observer.observe(el)
        return () => observer.disconnect()
    }, [hasData])

    const totals = translatedOutcomes.map((outcome) => ({
        ...outcome,
        value: buckets.reduce(
            (sum, bucket) => sum + bucket[outcome.key],
            0
        ),
    }))

    const grandTotal = totals.reduce((sum, outcome) => sum + outcome.value, 0)
    const ticks = niceTicks(Math.max(...buckets.map(total), 0))
    const top = ticks[ticks.length - 1]
    const n = buckets.length
    const showCaps = n <= MAX_CAP_LABELS
    const labelEvery = Math.ceil(
        n / Math.max(2, Math.floor(plotWidth / AXIS_LABEL_PX))
    )

    return (
        <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {totals.map((outcome) => (
                    <li key={outcome.key} className="flex items-center gap-2">
                        <span
                            className={cn(
                                "h-2.5 w-2.5 rounded-sm",
                                outcome.fill
                            )}
                            aria-hidden
                        />
                        <span className="font-medium">
                            {outcome.translatedLabel}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                            {outcome.value.toLocaleString(
                                language === "ar" ? "ar-LB" : "en-US"
                            )}
                        </span>
                    </li>
                ))}
            </ul>

            {grandTotal === 0 ? (
                <p className="flex h-64 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                    {t(language, "No appointments in this period.")}
                </p>
            ) : (
                <div className="flex gap-3 pt-6">
                    <div
                        className="relative h-64 w-6 shrink-0 text-[10px] text-muted-foreground"
                        aria-hidden
                    >
                        {ticks.map((tick) => (
                            <span
                                key={tick}
                                className="absolute right-0 translate-y-1/2 tabular-nums"
                                style={{ bottom: `${(tick / top) * 100}%` }}
                            >
                                {tick.toLocaleString(
                                    language === "ar" ? "ar-LB" : "en-US"
                                )}
                            </span>
                        ))}
                    </div>

                    <div className="min-w-0 flex-1" ref={plotRef}>
                        <div
                            className="relative h-64"
                            onPointerLeave={() => setActive(null)}
                        >
                            {ticks.map((tick) => (
                                <div
                                    key={tick}
                                    className={cn(
                                        "absolute inset-x-0 border-t",
                                        tick === 0
                                            ? "border-border"
                                            : "border-dashed border-border/60"
                                    )}
                                    style={{ bottom: `${(tick / top) * 100}%` }}
                                    aria-hidden
                                />
                            ))}

                            <div className="absolute inset-0 flex gap-[2px]">
                                {buckets.map((bucket, index) => {
                                    const sum = total(bucket)
                                    const height = (sum / top) * 100

                                    const topSegment =
                                        translatedOutcomes.findLastIndex(
                                            (outcome) =>
                                                bucket[outcome.key] > 0
                                        )

                                    const summary =
                                        `${bucket.fullLabel}: ${sum} ${t(language, "appointments")}` +
                                        translatedOutcomes
                                            .map(
                                                (outcome) =>
                                                    `, ${bucket[outcome.key]} ${outcome.translatedLabel.toLowerCase()}`
                                            )
                                            .join("")

                                    return (
                                        <div
                                            key={bucket.key}
                                            role="img"
                                            tabIndex={0}
                                            aria-label={summary}
                                            className={cn(
                                                "relative flex-1 rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                                                active === index && "bg-muted/70"
                                            )}
                                            onPointerEnter={() =>
                                                setActive(index)
                                            }
                                            onFocus={() => setActive(index)}
                                            onBlur={() => setActive(null)}
                                        >
                                            {sum > 0 && (
                                                <div
                                                    className={cn(
                                                        "absolute bottom-0 left-1/2 flex w-full max-w-7 -translate-x-1/2 flex-col-reverse gap-[2px] transition-[filter]",
                                                        active === index &&
                                                            "brightness-110"
                                                    )}
                                                    style={{ height: `${height}%` }}
                                                >
                                                    {translatedOutcomes.map(
                                                        (outcome, segmentIndex) =>
                                                            bucket[outcome.key] > 0 ? (
                                                                <div
                                                                    key={outcome.key}
                                                                    className={cn(
                                                                        outcome.fill,
                                                                        segmentIndex === topSegment &&
                                                                            "rounded-t-[4px]"
                                                                    )}
                                                                    style={{
                                                                        flexGrow:
                                                                            bucket[
                                                                                outcome.key
                                                                            ],
                                                                        flexBasis: 0,
                                                                        minHeight: 2,
                                                                    }}
                                                                />
                                                            ) : null
                                                    )}
                                                </div>
                                            )}

                                            {showCaps && sum > 0 && (
                                                <span
                                                    className="absolute left-1/2 -translate-x-1/2 text-[10px] font-semibold tabular-nums"
                                                    style={{
                                                        bottom: `calc(${height}% + 4px)`,
                                                    }}
                                                    aria-hidden
                                                >
                                                    {sum.toLocaleString(
                                                        language === "ar"
                                                            ? "ar-LB"
                                                            : "en-US"
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {active !== null && (
                                <Tooltip
                                    bucket={buckets[active]}
                                    index={active}
                                    count={n}
                                    plotWidth={plotWidth}
                                    language={language}
                                />
                            )}
                        </div>

                        <div
                            className="mt-2 flex h-4 gap-[2px]"
                            aria-hidden
                        >
                            {buckets.map((bucket, index) => (
                                <span
                                    key={bucket.key}
                                    className="relative flex-1"
                                >
                                    {index % labelEvery === 0 && (
                                        <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-muted-foreground">
                                            {bucket.label}
                                        </span>
                                    )}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {grandTotal > 0 && (
                <details className="group rounded-xl border">
                    <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                        {t(language, "View as table")}
                    </summary>

                    <div className="max-h-80 overflow-y-auto border-t">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="pl-4">
                                        {t(language, "Period")}
                                    </TableHead>

                                    {translatedOutcomes.map((outcome) => (
                                        <TableHead
                                            key={outcome.key}
                                            className="text-right"
                                        >
                                            {outcome.translatedLabel}
                                        </TableHead>
                                    ))}

                                    <TableHead className="pr-4 text-right">
                                        {t(language, "Total")}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {buckets.map((bucket) => (
                                    <TableRow key={bucket.key}>
                                        <TableCell className="py-2 pl-4">
                                            {bucket.fullLabel}
                                        </TableCell>

                                        {translatedOutcomes.map((outcome) => (
                                            <TableCell
                                                key={outcome.key}
                                                className="py-2 text-right tabular-nums"
                                            >
                                                {bucket[outcome.key].toLocaleString(
                                                    language === "ar"
                                                        ? "ar-LB"
                                                        : "en-US"
                                                )}
                                            </TableCell>
                                        ))}

                                        <TableCell className="py-2 pr-4 text-right font-semibold tabular-nums">
                                            {total(bucket).toLocaleString(
                                                language === "ar"
                                                    ? "ar-LB"
                                                    : "en-US"
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </details>
            )}
        </div>
    )
}

function Tooltip({
    bucket,
    index,
    count,
    plotWidth,
    language,
}: {
    bucket: OutcomeBucket
    index: number
    count: number
    plotWidth: number
    language: "en" | "ar"
}) {
    const roomRight = (plotWidth * (count - index - 1)) / count
    const roomLeft = (plotWidth * index) / count

    const position =
        roomRight >= TOOLTIP_PX &&
        (roomRight >= roomLeft || roomLeft < TOOLTIP_PX)
            ? { left: `calc(${((index + 1) / count) * 100}% + 8px)` }
            : roomLeft >= TOOLTIP_PX
              ? { right: `calc(${((count - index) / count) * 100}% + 8px)` }
              : {
                    left: 0,
                    right: 0,
                    top: "auto",
                    bottom: "calc(100% + 8px)",
                }

    const translatedOutcomes = OUTCOMES.map((outcome) => ({
        ...outcome,
        translatedLabel: t(language, outcome.label),
    }))

    return (
        <div
            className="pointer-events-none absolute top-0 z-10 min-w-40 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
            style={position}
            dir={language === "ar" ? "rtl" : "ltr"}
        >
            <p className="mb-2 text-xs text-muted-foreground">
                {bucket.fullLabel}
            </p>

            <ul className="space-y-1">
                {translatedOutcomes.map((outcome) => (
                    <li
                        key={outcome.key}
                        className="flex items-center gap-2 text-xs"
                    >
                        <span
                            className={cn(
                                "h-0.5 w-3 rounded-full",
                                outcome.fill
                            )}
                            aria-hidden
                        />
                        <span className="font-semibold tabular-nums">
                            {bucket[outcome.key].toLocaleString(
                                language === "ar" ? "ar-LB" : "en-US"
                            )}
                        </span>
                        <span className="text-muted-foreground">
                            {outcome.translatedLabel}
                        </span>
                    </li>
                ))}
            </ul>

            <p className="mt-2 border-t pt-2 text-xs">
                <span className="font-semibold tabular-nums">
                    {total(bucket).toLocaleString(
                        language === "ar" ? "ar-LB" : "en-US"
                    )}
                </span>{" "}
                <span className="text-muted-foreground">
                    {t(language, "total")}
                </span>
            </p>
        </div>
    )
}
