import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Users,
    Calendar,
    CalendarCheck,
    CalendarX,
    DollarSign,
    Star,
    Download,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import Appointment, { type IAppointment } from "@/models/Appointment"
import AIRun from "@/models/AIRun"
import Doctor from "@/models/Doctor"
import { OutcomesChart, type OutcomeBucket } from "./outcomes-chart"
import { RANGES, resolveRange, type ResolvedRange } from "./range"

// Every figure is computed live for the selected range.
export const dynamic = "force-dynamic"

const DAY_MS = 24 * 60 * 60 * 1000
/** How many doctors / specialties the ranked lists show. */
const TOP_DOCTORS = 4
const TOP_SPECIALTIES = 5
/** AI reply success below this share is flagged. */
const AI_SUCCESS_WARN = 0.8

type Status = IAppointment["status"]
type PopulatedDoctor = { _id: unknown; name?: string; specialty?: string; rating?: number } | null
type Appt = {
    date: Date
    time: string
    status: Status
    type: IAppointment["type"]
    price: number
    doctor: PopulatedDoctor
}

// Appointment dates are stored as UTC midnight, so format them in UTC.
const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts })
const monthDay = fmt({ month: "short", day: "numeric" })
const monthDayYear = fmt({ month: "short", day: "numeric", year: "numeric" })
const weekdayMonthDayYear = fmt({ weekday: "short", month: "short", day: "numeric", year: "numeric" })
const shortMonth = fmt({ month: "short" })
const monthYear = fmt({ month: "long", year: "numeric" })
const twoDigitYear = fmt({ year: "2-digit" })

function money(value: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
        notation: value >= 10_000 ? "compact" : "standard",
    }).format(value)
}

function to12h(hour: number): string {
    const period = hour >= 12 ? "PM" : "AM"
    const hour12 = hour % 12 === 0 ? 12 : hour % 12
    return `${hour12} ${period}`
}

function percent(value: number | null): string {
    return value === null ? "—" : `${Math.round(value * 100)}%`
}

// ── Period summaries & deltas ─────────────────────────────────────────────

function summarize(list: Appt[]) {
    const count = (s: Status) => list.filter((a) => a.status === s).length
    const completed = count("completed")
    const missed = count("missed")
    const cancelled = count("cancelled")
    const due = completed + missed
    return {
        booked: list.length,
        completed,
        missed,
        cancelled,
        due,
        revenue: list.filter((a) => a.status === "completed").reduce((sum, a) => sum + a.price, 0),
        // Of the visits that came due, how many actually happened.
        completionRate: due > 0 ? completed / due : null,
        cancellationRate: list.length > 0 ? cancelled / list.length : null,
    }
}

type Delta = { text: string; direction: "up" | "down" | "flat"; good: boolean | null }

/** Change of a count or amount: a percentage when there is a base, else the absolute rise. */
function changeDelta(
    current: number,
    previous: number,
    upIsGood = true,
    format: (n: number) => string = (n) => n.toLocaleString()
): Delta {
    if (previous === 0) {
        if (current === 0) return { text: "No change", direction: "flat", good: null }
        return { text: `+${format(current)}`, direction: "up", good: upIsGood }
    }
    const pct = Math.round(((current - previous) / previous) * 100)
    if (pct === 0) return { text: "0%", direction: "flat", good: null }
    const up = pct > 0
    return { text: `${up ? "+" : ""}${pct}%`, direction: up ? "up" : "down", good: up === upIsGood }
}

/** Change of a rate, in percentage points. */
function pointsDelta(current: number | null, previous: number | null, upIsGood = true): Delta | undefined {
    if (current === null || previous === null) return undefined
    const pts = Math.round((current - previous) * 100)
    if (pts === 0) return { text: "0 pts", direction: "flat", good: null }
    const up = pts > 0
    return { text: `${up ? "+" : ""}${pts} pts`, direction: up ? "up" : "down", good: up === upIsGood }
}

// ── Chart buckets ─────────────────────────────────────────────────────────

type BucketFrame = { start: number; key: string; label: string; fullLabel: string }

function bucketFrames(range: ResolvedRange): BucketFrame[] {
    const frames: BucketFrame[] = []
    const end = range.end.getTime()

    if (range.bucket === "month") {
        let y = range.start.getUTCFullYear()
        let m = range.start.getUTCMonth()
        for (let t = Date.UTC(y, m, 1); t < end; t = Date.UTC(y, m, 1)) {
            const d = new Date(t)
            // Show the year where it changes, so "Jan" is never ambiguous.
            const label = frames.length === 0 || m === 0
                ? `${shortMonth.format(d)} ’${twoDigitYear.format(d)}`
                : shortMonth.format(d)
            frames.push({ start: t, key: d.toISOString(), label, fullLabel: monthYear.format(d) })
            m += 1
            if (m === 12) { m = 0; y += 1 }
        }
        return frames
    }

    const step = range.bucket === "week" ? 7 * DAY_MS : DAY_MS
    for (let t = range.start.getTime(); t < end; t += step) {
        const d = new Date(t)
        frames.push({
            start: t,
            key: d.toISOString(),
            label: monthDay.format(d),
            fullLabel: range.bucket === "week"
                ? `Week of ${monthDayYear.format(d)}`
                : weekdayMonthDayYear.format(d),
        })
    }
    return frames
}

function outcomeBuckets(range: ResolvedRange, list: Appt[]): OutcomeBucket[] {
    const frames = bucketFrames(range)
    const buckets: OutcomeBucket[] = frames.map(({ key, label, fullLabel }) => ({
        key, label, fullLabel, completed: 0, missed: 0, cancelled: 0, scheduled: 0,
    }))
    for (const a of list) {
        const t = new Date(a.date).getTime()
        // Frames are in order; the appointment belongs to the last one starting at or before it.
        let i = frames.length - 1
        while (i > 0 && frames[i].start > t) i--
        const b = buckets[i]
        if (a.status === "completed") b.completed++
        else if (a.status === "missed") b.missed++
        else if (a.status === "cancelled") b.cancelled++
        else b.scheduled++
    }
    return buckets
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function AdminReportsPage({
    searchParams,
}: {
    searchParams: Promise<{ range?: string }>
}) {
    await requireRole("admin")
    const range = resolveRange((await searchParams).range)
    await connectDB()

    const [appointmentDocs, aiRuns, doctorRatings] = await Promise.all([
        Appointment.find({ date: { $gte: range.prevStart, $lt: range.end } })
            .select("date time status type price doctor")
            .populate<{ doctor: PopulatedDoctor }>("doctor", "name specialty rating")
            .lean(),
        AIRun.find({ mode: "patient", createdAt: { $gte: range.start, $lt: range.end } })
            .select("success durationMs knowledgeSearches knowledgeHits")
            .lean(),
        Doctor.find({ status: "active" }).select("rating reviews").lean(),
    ])

    const startMs = range.start.getTime()
    const appts = appointmentDocs as unknown as Appt[]
    const current = appts.filter((a) => new Date(a.date).getTime() >= startMs)
    const previous = appts.filter((a) => new Date(a.date).getTime() < startMs)
    const cur = summarize(current)
    const prev = summarize(previous)
    const visits = current.filter((a) => a.status !== "cancelled")

    // ── KPI row ───────────────────────────────────────────────────────────

    const kpis: { title: string; value: string; icon: LucideIcon; color: string; bg: string; delta?: Delta; note: string }[] = [
        {
            title: "Booked Appointments",
            value: cur.booked.toLocaleString(),
            delta: changeDelta(cur.booked, prev.booked),
            note: `${cur.cancelled} later cancelled`,
            icon: Calendar,
            color: "text-blue-600",
            bg: "bg-blue-100 dark:bg-blue-900/20",
        },
        {
            title: "Completion Rate",
            value: percent(cur.completionRate),
            delta: pointsDelta(cur.completionRate, prev.completionRate),
            note: cur.due > 0 ? `${cur.completed} of ${cur.due} due visits attended` : "No visits came due",
            icon: CalendarCheck,
            color: "text-emerald-600",
            bg: "bg-emerald-100 dark:bg-emerald-900/20",
        },
        {
            title: "Cancellation Rate",
            value: percent(cur.cancellationRate),
            delta: pointsDelta(cur.cancellationRate, prev.cancellationRate, false),
            note: `${cur.cancelled} of ${cur.booked} bookings`,
            icon: CalendarX,
            color: "text-orange-600",
            bg: "bg-orange-100 dark:bg-orange-900/20",
        },
        {
            title: "Revenue",
            value: money(cur.revenue),
            delta: changeDelta(cur.revenue, prev.revenue, true, money),
            note: "From completed visits",
            icon: DollarSign,
            color: "text-purple-600",
            bg: "bg-purple-100 dark:bg-purple-900/20",
        },
    ]

    // ── Key metrics ───────────────────────────────────────────────────────

    const aiSucceeded = aiRuns.filter((r) => r.success).length
    const aiSuccessRate = aiRuns.length > 0 ? aiSucceeded / aiRuns.length : null
    const aiAvgSeconds = aiRuns.length > 0
        ? aiRuns.reduce((sum, r) => sum + r.durationMs, 0) / aiRuns.length / 1000
        : null
    const aiSearched = aiRuns.filter((r) => r.knowledgeSearches > 0)
    const aiAnswerRate = aiSearched.length > 0
        ? aiSearched.filter((r) => r.knowledgeHits > 0).length / aiSearched.length
        : null

    const byHour = new Map<number, number>()
    for (const a of visits) {
        const hour = Number.parseInt(a.time.slice(0, 2), 10)
        if (!Number.isNaN(hour)) byHour.set(hour, (byHour.get(hour) ?? 0) + 1)
    }
    const peak = [...byHour.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]

    const videoVisits = visits.filter((a) => a.type === "video").length
    const videoShare = visits.length > 0 ? videoVisits / visits.length : null

    const reviewTotal = doctorRatings.reduce((sum, d) => sum + (d.reviews ?? 0), 0)
    const ratedDoctors = doctorRatings.filter((d) => (d.rating ?? 0) > 0)
    const avgRating = reviewTotal > 0
        ? doctorRatings.reduce((sum, d) => sum + (d.rating ?? 0) * (d.reviews ?? 0), 0) / reviewTotal
        : ratedDoctors.length > 0
            ? ratedDoctors.reduce((sum, d) => sum + (d.rating ?? 0), 0) / ratedDoctors.length
            : null

    const specialtyCounts = new Map<string, number>()
    for (const a of visits) {
        const name = a.doctor?.specialty ?? "Unknown"
        specialtyCounts.set(name, (specialtyCounts.get(name) ?? 0) + 1)
    }
    const specialties = [...specialtyCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, TOP_SPECIALTIES)

    // ── Most booked doctors ───────────────────────────────────────────────

    const tally = (list: Appt[]) => {
        const map = new Map<string, { name: string; specialty: string; rating: number; booked: number; completed: number }>()
        for (const a of list) {
            if (a.status === "cancelled" || !a.doctor) continue
            const id = String(a.doctor._id)
            const entry = map.get(id) ?? {
                name: a.doctor.name ?? "Unknown doctor",
                specialty: a.doctor.specialty ?? "",
                rating: a.doctor.rating ?? 0,
                booked: 0,
                completed: 0,
            }
            entry.booked++
            if (a.status === "completed") entry.completed++
            map.set(id, entry)
        }
        return map
    }
    const prevByDoctor = tally(previous)
    const topDoctors = [...tally(current).entries()]
        .sort((a, b) => b[1].booked - a[1].booked || b[1].completed - a[1].completed)
        .slice(0, TOP_DOCTORS)
        .map(([id, d]) => ({ id, ...d, delta: changeDelta(d.booked, prevByDoctor.get(id)?.booked ?? 0) }))

    const lastDay = new Date(range.end.getTime() - DAY_MS)

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
                    <p className="text-muted-foreground mt-1">
                        Clinic performance for {monthDayYear.format(range.start)} – {monthDayYear.format(lastDay)}.
                    </p>
                </div>
                {/* A plain link: the browser downloads the CSV the route returns. */}
                <a href={`/admin/reports/export?range=${range.key}`} download>
                    <Button className="h-11 px-6 shadow-lg shadow-blue-200 gap-2 font-bold">
                        <Download className="h-4 w-4" />
                        Export CSV
                    </Button>
                </a>
            </div>

            {/* Date range: one row above everything it scopes. */}
            <nav className="flex flex-wrap gap-2" aria-label="Report period">
                {RANGES.map((r) => (
                    <Link
                        key={r.key}
                        href={`/admin/reports?range=${r.key}`}
                        scroll={false}
                        aria-current={r.key === range.key ? "page" : undefined}
                        className={cn(
                            "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                            r.key === range.key
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-card border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {r.label}
                    </Link>
                ))}
            </nav>

            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {kpis.map((kpi) => (
                    <Card key={kpi.title} className="border-none shadow-sm bg-card/60 backdrop-blur-sm group hover:shadow-md transition-all">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                            <div className={`${kpi.bg} ${kpi.color} p-2 rounded-xl transition-transform group-hover:scale-110`}>
                                <kpi.icon className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{kpi.value}</div>
                            {kpi.delta && <DeltaLine delta={kpi.delta} period={range.prevLabel} />}
                            <p className="mt-1 text-xs text-muted-foreground">{kpi.note}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Outcomes over time */}
                <Card className="lg:col-span-3 border-none bg-card shadow-sm overflow-hidden">
                    <CardHeader className="border-b bg-muted/20 px-8 py-6">
                        <CardTitle className="text-2xl">Appointment Outcomes</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            What happened to appointments dated in this period, by {range.bucket}.
                        </p>
                    </CardHeader>
                    <CardContent className="p-8">
                        <OutcomesChart buckets={outcomeBuckets(range, current)} />
                    </CardContent>
                </Card>

                {/* Key metrics */}
                <Card className="border-none bg-card shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Key Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-7">
                        <Metric
                            label="AI reply success"
                            value={percent(aiSuccessRate)}
                            share={aiSuccessRate}
                            warn={aiSuccessRate !== null && aiSuccessRate < AI_SUCCESS_WARN}
                            note={aiRuns.length > 0
                                ? `${aiRuns.length} replies · avg ${aiAvgSeconds!.toFixed(1)}s`
                                : "No patient chats in this period"}
                        />
                        <Metric
                            label="FAQ answer rate"
                            value={percent(aiAnswerRate)}
                            share={aiAnswerRate}
                            note={aiSearched.length > 0
                                ? `${aiSearched.length} knowledge searches`
                                : "No knowledge searches yet"}
                        />
                        <Metric
                            label="Video visits"
                            value={percent(videoShare)}
                            share={videoShare}
                            note={visits.length > 0
                                ? `${videoVisits} video · ${visits.length - videoVisits} in-person`
                                : "No visits in this period"}
                        />
                        <Metric
                            label="Avg doctor rating"
                            value={avgRating === null ? "—" : `${avgRating.toFixed(1)} / 5`}
                            share={avgRating === null ? null : avgRating / 5}
                            note={reviewTotal > 0 ? `${reviewTotal.toLocaleString()} reviews · all time` : "All time"}
                        />

                        <div className="pt-6 border-t">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Busiest Hour</p>
                            {peak ? (
                                <p className="text-sm">
                                    <span className="font-semibold">{to12h(peak[0])} – {to12h(peak[0] + 1)}</span>
                                    <span className="text-muted-foreground"> · {peak[1]} of {visits.length} visits</span>
                                </p>
                            ) : (
                                <p className="text-sm text-muted-foreground">No visits in this period.</p>
                            )}
                        </div>

                        <div className="pt-6 border-t">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Popular Specialties</p>
                            {specialties.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No visits in this period.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {specialties.map(([name, count]) => (
                                        <li key={name} className="space-y-1.5" title={`${name}: ${count} of ${visits.length} visits`}>
                                            <div className="flex items-center justify-between gap-2 text-sm">
                                                <span className="truncate">{name}</span>
                                                <span className="text-xs font-bold tabular-nums">
                                                    {Math.round((count / visits.length) * 100)}%
                                                </span>
                                            </div>
                                            <Bar share={count / visits.length} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Most booked doctors */}
            <Card className="border-none bg-card shadow-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b px-8 py-6">
                    <div>
                        <CardTitle className="text-xl">Most Booked Doctors</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Ranked by appointments in this period, excluding cancellations; change vs {range.prevLabel}.
                        </p>
                    </div>
                    <Link href="/admin/doctors">
                        <Button variant="ghost" className="text-primary font-bold">Manage Doctors</Button>
                    </Link>
                </CardHeader>
                <CardContent className="p-0">
                    {topDoctors.length === 0 ? (
                        <p className="p-12 text-center text-sm text-muted-foreground">No appointments in this period.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-muted/50">
                            {topDoctors.map((doc) => (
                                <div key={doc.id} className="p-8 hover:bg-muted/10 transition-colors group">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center border-2 border-background shadow-sm overflow-hidden group-hover:scale-110 transition-transform">
                                            <Users className="h-6 w-6 text-primary" />
                                        </div>
                                        <Badge
                                            variant={doc.delta.good === null ? "secondary" : doc.delta.good ? "success" : "destructive"}
                                            className="text-[10px]"
                                        >
                                            {doc.delta.text}
                                        </Badge>
                                    </div>
                                    <h4 className="font-bold text-lg mb-1">{doc.name}</h4>
                                    <p className="text-primary text-xs font-bold uppercase tracking-tight mb-4">{doc.specialty}</p>
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center text-muted-foreground font-medium" title={`${doc.completed} completed`}>
                                            <Calendar className="h-3.5 w-3.5 mr-1" />
                                            {doc.booked} booked · {doc.completed} done
                                        </div>
                                        <div className="flex items-center font-bold">
                                            <Star className="h-3.5 w-3.5 mr-1 text-amber-500 fill-amber-500" />
                                            {doc.rating ? doc.rating.toFixed(1) : "—"}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

// ── Small pieces ──────────────────────────────────────────────────────────

/** Signed change vs the named comparison period; color says whether it is good. */
function DeltaLine({ delta, period }: { delta: Delta; period: string }) {
    const Icon = delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : Minus
    const tone = delta.good === null ? "text-muted-foreground" : delta.good ? "text-emerald-600" : "text-destructive"
    return (
        <div className="flex items-center mt-1">
            <Icon className={cn("h-4 w-4 mr-1", tone)} />
            <span className={cn("font-medium text-xs", tone)}>{delta.text}</span>
            <span className="text-[10px] text-muted-foreground ml-1">vs {period}</span>
        </div>
    )
}

function Metric({
    label,
    value,
    share,
    note,
    warn = false,
}: {
    label: string
    value: string
    share: number | null
    note: string
    warn?: boolean
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
                <span className="text-sm font-bold">
                    {value}
                    {warn && <span className="ml-1 text-xs font-semibold text-amber-700 dark:text-amber-400">Low</span>}
                </span>
            </div>
            <Bar share={share ?? 0} warn={warn} label={`${label}: ${value}`} />
            <p className="mt-1.5 text-[11px] text-muted-foreground">{note}</p>
        </div>
    )
}

/** A meter: same-ramp track, fill turns amber when flagged. */
function Bar({ share, warn = false, label }: { share: number; warn?: boolean; label?: string }) {
    const pct = Math.round(Math.min(Math.max(share, 0), 1) * 100)
    return (
        <div
            role="meter"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className={cn(
                "h-2 w-full rounded-full overflow-hidden",
                warn ? "bg-amber-100 dark:bg-amber-950" : "bg-blue-100 dark:bg-blue-950"
            )}
        >
            {pct > 0 && (
                <div
                    className={cn("h-full rounded-full", warn ? "bg-amber-500" : "bg-blue-600 dark:bg-blue-500")}
                    style={{ width: `${pct}%` }}
                />
            )}
        </div>
    )
}
