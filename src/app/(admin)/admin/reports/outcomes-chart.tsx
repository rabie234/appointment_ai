"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"

export type OutcomeBucket = {
    key: string
    /** Short axis label, e.g. "Oct 25". */
    label: string
    /** Full period name for the tooltip and table, e.g. "Week of Oct 6, 2026". */
    fullLabel: string
    completed: number
    missed: number
    cancelled: number
    scheduled: number
}

// Bottom-to-top stack order, mapped to the categorical slots in fixed order.
const OUTCOMES = [
    { key: "completed", label: "Completed", fill: "bg-series-1" },
    { key: "missed", label: "Missed", fill: "bg-series-2" },
    { key: "cancelled", label: "Cancelled", fill: "bg-series-3" },
    { key: "scheduled", label: "Scheduled", fill: "bg-series-4" },
] as const

/** Column caps get a total only while they have room to read. */
const MAX_CAP_LABELS = 13
/** Room one x-axis label needs ("Oct 25") before neighbours collide, in px. */
const AXIS_LABEL_PX = 48
/** Plot width assumed before it has been measured (a typical desktop card). */
const DEFAULT_PLOT_PX = 640
/** Tooltip width plus its gap from the column, in px. */
const TOOLTIP_PX = 176

function total(b: OutcomeBucket): number {
    return b.completed + b.missed + b.cancelled + b.scheduled
}

/** Clean whole-number y-axis ticks (counts are never fractional). */
function niceTicks(max: number): number[] {
    if (max <= 0) return [0, 1]
    const rough = max / 4
    const pow = 10 ** Math.floor(Math.log10(rough))
    const step = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? pow * 10)
    const top = Math.ceil(max / step) * step
    const ticks: number[] = []
    for (let v = 0; v <= top; v += step) ticks.push(v)
    return ticks
}

export function OutcomesChart({ buckets }: { buckets: OutcomeBucket[] }) {
    const [active, setActive] = useState<number | null>(null)
    const [plotWidth, setPlotWidth] = useState(DEFAULT_PLOT_PX)
    const plotRef = useRef<HTMLDivElement>(null)
    const hasData = buckets.some((b) => total(b) > 0)

    // Axis labels and tooltip placement both fit the plot's real width.
    useEffect(() => {
        const el = plotRef.current
        if (!el) return
        const observer = new ResizeObserver(([entry]) => {
            setPlotWidth(entry.contentRect.width)
        })
        observer.observe(el)
        return () => observer.disconnect()
        // The plot only mounts once there is data; re-attach when that changes.
    }, [hasData])

    const totals = OUTCOMES.map((o) => ({
        ...o,
        value: buckets.reduce((sum, b) => sum + b[o.key], 0),
    }))
    const grandTotal = totals.reduce((sum, o) => sum + o.value, 0)

    const ticks = niceTicks(Math.max(...buckets.map(total), 0))
    const top = ticks[ticks.length - 1]
    const n = buckets.length
    const showCaps = n <= MAX_CAP_LABELS
    const labelEvery = Math.ceil(n / Math.max(2, Math.floor(plotWidth / AXIS_LABEL_PX)))

    return (
        <div className="space-y-6">
            {/* Legend: the dependable identity for every series. */}
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {totals.map((o) => (
                    <li key={o.key} className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-sm", o.fill)} aria-hidden />
                        <span className="font-medium">{o.label}</span>
                        <span className="text-muted-foreground tabular-nums">{o.value.toLocaleString()}</span>
                    </li>
                ))}
            </ul>

            {grandTotal === 0 ? (
                <p className="flex h-64 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                    No appointments in this period.
                </p>
            ) : (
                <div className="flex gap-3 pt-6">
                    {/* Y axis */}
                    <div className="relative h-64 w-6 shrink-0 text-[10px] text-muted-foreground" aria-hidden>
                        {ticks.map((t) => (
                            <span
                                key={t}
                                className="absolute right-0 translate-y-1/2 tabular-nums"
                                style={{ bottom: `${(t / top) * 100}%` }}
                            >
                                {t.toLocaleString()}
                            </span>
                        ))}
                    </div>

                    <div className="flex-1 min-w-0" ref={plotRef}>
                        <div className="relative h-64" onPointerLeave={() => setActive(null)}>
                            {/* Recessive gridlines */}
                            {ticks.map((t) => (
                                <div
                                    key={t}
                                    className={cn(
                                        "absolute inset-x-0 border-t",
                                        t === 0 ? "border-border" : "border-dashed border-border/60"
                                    )}
                                    style={{ bottom: `${(t / top) * 100}%` }}
                                    aria-hidden
                                />
                            ))}

                            <div className="absolute inset-0 flex gap-[2px]">
                                {buckets.map((b, i) => {
                                    const sum = total(b)
                                    const height = (sum / top) * 100
                                    const topSegment = OUTCOMES.findLastIndex((o) => b[o.key] > 0)
                                    const summary =
                                        `${b.fullLabel}: ${sum} appointment${sum === 1 ? "" : "s"}` +
                                        OUTCOMES.map((o) => `, ${b[o.key]} ${o.label.toLowerCase()}`).join("")
                                    return (
                                        // The whole column slot is the hit target, not just the painted bar.
                                        <div
                                            key={b.key}
                                            role="img"
                                            tabIndex={0}
                                            aria-label={summary}
                                            className={cn(
                                                "relative flex-1 rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                                                active === i && "bg-muted/70"
                                            )}
                                            onPointerEnter={() => setActive(i)}
                                            onFocus={() => setActive(i)}
                                            onBlur={() => setActive(null)}
                                        >
                                            {sum > 0 && (
                                                <div
                                                    className={cn(
                                                        "absolute bottom-0 left-1/2 flex w-full max-w-7 -translate-x-1/2 flex-col-reverse gap-[2px] transition-[filter]",
                                                        active === i && "brightness-110"
                                                    )}
                                                    style={{ height: `${height}%` }}
                                                >
                                                    {OUTCOMES.map((o, s) =>
                                                        b[o.key] > 0 ? (
                                                            <div
                                                                key={o.key}
                                                                className={cn(o.fill, s === topSegment && "rounded-t-[4px]")}
                                                                style={{ flexGrow: b[o.key], flexBasis: 0, minHeight: 2 }}
                                                            />
                                                        ) : null
                                                    )}
                                                </div>
                                            )}
                                            {showCaps && sum > 0 && (
                                                <span
                                                    className="absolute left-1/2 -translate-x-1/2 text-[10px] font-semibold tabular-nums"
                                                    style={{ bottom: `calc(${height}% + 4px)` }}
                                                    aria-hidden
                                                >
                                                    {sum}
                                                </span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {active !== null && (
                                <Tooltip bucket={buckets[active]} index={active} count={n} plotWidth={plotWidth} />
                            )}
                        </div>

                        {/* X axis: labels are skipped to fit, so each may spill into its empty neighbours. */}
                        <div className="mt-2 flex h-4 gap-[2px]" aria-hidden>
                            {buckets.map((b, i) => (
                                <span key={b.key} className="relative flex-1">
                                    {i % labelEvery === 0 && (
                                        <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-muted-foreground">
                                            {b.label}
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
                        View as table
                    </summary>
                    <div className="max-h-80 overflow-y-auto border-t">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="pl-4">Period</TableHead>
                                    {OUTCOMES.map((o) => (
                                        <TableHead key={o.key} className="text-right">{o.label}</TableHead>
                                    ))}
                                    <TableHead className="text-right pr-4">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {buckets.map((b) => (
                                    <TableRow key={b.key}>
                                        <TableCell className="pl-4 py-2">{b.fullLabel}</TableCell>
                                        {OUTCOMES.map((o) => (
                                            <TableCell key={o.key} className="py-2 text-right tabular-nums">{b[o.key]}</TableCell>
                                        ))}
                                        <TableCell className="py-2 pr-4 text-right font-semibold tabular-nums">{total(b)}</TableCell>
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

/** One readout for every series in the hovered period; values lead, names follow. */
function Tooltip({
    bucket,
    index,
    count,
    plotWidth,
}: {
    bucket: OutcomeBucket
    index: number
    count: number
    plotWidth: number
}) {
    // Sit beside the hovered column (never over it) on whichever side has room.
    // When neither side does (narrow phones), float above the plot instead.
    const roomRight = (plotWidth * (count - index - 1)) / count
    const roomLeft = (plotWidth * index) / count
    const position =
        roomRight >= TOOLTIP_PX && (roomRight >= roomLeft || roomLeft < TOOLTIP_PX)
            ? { left: `calc(${((index + 1) / count) * 100}% + 8px)` }
            : roomLeft >= TOOLTIP_PX
                ? { right: `calc(${((count - index) / count) * 100}% + 8px)` }
                : { left: 0, right: 0, top: "auto", bottom: "calc(100% + 8px)" }

    return (
        <div
            className="pointer-events-none absolute top-0 z-10 min-w-40 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
            style={position}
        >
            <p className="mb-2 text-xs text-muted-foreground">{bucket.fullLabel}</p>
            <ul className="space-y-1">
                {OUTCOMES.map((o) => (
                    <li key={o.key} className="flex items-center gap-2 text-xs">
                        <span className={cn("h-0.5 w-3 rounded-full", o.fill)} aria-hidden />
                        <span className="font-semibold tabular-nums">{bucket[o.key]}</span>
                        <span className="text-muted-foreground">{o.label}</span>
                    </li>
                ))}
            </ul>
            <p className="mt-2 border-t pt-2 text-xs">
                <span className="font-semibold tabular-nums">{total(bucket)}</span>
                <span className="text-muted-foreground"> total</span>
            </p>
        </div>
    )
}
