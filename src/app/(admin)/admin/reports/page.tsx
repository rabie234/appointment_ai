import Link from "next/link"
import { cookies } from "next/headers"
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
import { t } from "@/components/i18n/translations";
import type { Language } from "@/components/i18n/language-provider";
export const dynamic = "force-dynamic"

const DAY_MS = 24 * 60 * 60 * 1000
const TOP_DOCTORS = 4
const TOP_SPECIALTIES = 5
const AI_SUCCESS_WARN = 0.8

type Status = IAppointment["status"]
type PopulatedDoctor = {
    _id: unknown
    name?: string
    nameAr?: string
    specialty?: string
    rating?: number
} | null

type Appt = {
    date: Date
    time: string
    status: Status
    type: IAppointment["type"]
    price: number
    doctor: PopulatedDoctor
}

function createDateFormatter(
    language: Language,
    options: Intl.DateTimeFormatOptions
) {
    return new Intl.DateTimeFormat(
        language === "ar" ? "ar-LB" : "en-US",
        { timeZone: "UTC", ...options }
    )
}

function money(value: number, language: Language): string {
    return new Intl.NumberFormat(
        language === "ar" ? "ar-LB" : "en-US",
        {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
            notation: value >= 10_000 ? "compact" : "standard",
        }
    ).format(value)
}

function to12h(hour: number, language: Language): string {
    const safeHour = ((hour % 24) + 24) % 24

    return new Intl.DateTimeFormat(
        language === "ar" ? "ar-LB" : "en-US",
        {
            hour: "numeric",
            hour12: language === "en",
            timeZone: "UTC",
        }
    ).format(new Date(Date.UTC(2020, 0, 1, safeHour)))
}

function percent(value: number | null): string {
    return value === null ? "—" : `${Math.round(value * 100)}%`
}

type Delta = {
    text: string
    direction: "up" | "down" | "flat"
    good: boolean | null
}

function changeDelta(
    current: number,
    previous: number,
    upIsGood = true,
    format: (n: number) => string = (n) => n.toLocaleString()
): Delta {
    if (previous === 0) {
        if (current === 0) {
            return { text: "No change", direction: "flat", good: null }
        }

        return {
            text: `+${format(current)}`,
            direction: "up",
            good: upIsGood,
        }
    }

    const pct = Math.round(((current - previous) / previous) * 100)

    if (pct === 0) {
        return { text: "0%", direction: "flat", good: null }
    }

    const up = pct > 0

    return {
        text: `${up ? "+" : ""}${pct}%`,
        direction: up ? "up" : "down",
        good: up === upIsGood,
    }
}

function pointsDelta(
    current: number | null,
    previous: number | null,
    upIsGood = true
): Delta | undefined {
    if (current === null || previous === null) return undefined

    const pts = Math.round((current - previous) * 100)

    if (pts === 0) {
        return { text: "0 pts", direction: "flat", good: null }
    }

    const up = pts > 0

    return {
        text: `${up ? "+" : ""}${pts} pts`,
        direction: up ? "up" : "down",
        good: up === upIsGood,
    }
}

function summarize(list: Appt[]) {
    const count = (status: Status) =>
        list.filter((appointment) => appointment.status === status).length

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
        revenue: list
            .filter((appointment) => appointment.status === "completed")
            .reduce((sum, appointment) => sum + appointment.price, 0),
        completionRate: due > 0 ? completed / due : null,
        cancellationRate: list.length > 0 ? cancelled / list.length : null,
    }
}

type BucketFrame = {
    start: number
    key: string
    label: string
    fullLabel: string
}

function bucketFrames(
    range: ResolvedRange,
    language: Language
): BucketFrame[] {
    const frames: BucketFrame[] = []
    const end = range.end.getTime()

    const monthDay = createDateFormatter(language, {
        month: "short",
        day: "numeric",
    })

    const monthDayYear = createDateFormatter(language, {
        month: "short",
        day: "numeric",
        year: "numeric",
    })

    const weekdayMonthDayYear = createDateFormatter(language, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    })

    const shortMonth = createDateFormatter(language, {
        month: "short",
    })

    const monthYear = createDateFormatter(language, {
        month: "long",
        year: "numeric",
    })

    const twoDigitYear = createDateFormatter(language, {
        year: "2-digit",
    })

    if (range.bucket === "month") {
        let year = range.start.getUTCFullYear()
        let month = range.start.getUTCMonth()

        for (
            let timestamp = Date.UTC(year, month, 1);
            timestamp < end;
            timestamp = Date.UTC(year, month, 1)
        ) {
            const date = new Date(timestamp)

            const label =
                frames.length === 0 || month === 0
                    ? `${shortMonth.format(date)} ’${twoDigitYear.format(date)}`
                    : shortMonth.format(date)

            frames.push({
                start: timestamp,
                key: date.toISOString(),
                label,
                fullLabel: monthYear.format(date),
            })

            month += 1

            if (month === 12) {
                month = 0
                year += 1
            }
        }

        return frames
    }

    const step = range.bucket === "week" ? 7 * DAY_MS : DAY_MS

    for (
        let timestamp = range.start.getTime();
        timestamp < end;
        timestamp += step
    ) {
        const date = new Date(timestamp)

        frames.push({
            start: timestamp,
            key: date.toISOString(),
            label: monthDay.format(date),
            fullLabel:
                range.bucket === "week"
                    ? `${t(language, "Week of")} ${monthDayYear.format(date)}`
                    : weekdayMonthDayYear.format(date),
        })
    }

    return frames
}

function outcomeBuckets(
    range: ResolvedRange,
    list: Appt[],
    language: Language
): OutcomeBucket[] {
    const frames = bucketFrames(range, language)

    const buckets: OutcomeBucket[] = frames.map(
        ({ key, label, fullLabel }) => ({
            key,
            label,
            fullLabel,
            completed: 0,
            missed: 0,
            cancelled: 0,
            scheduled: 0,
        })
    )

    for (const appointment of list) {
        const timestamp = new Date(appointment.date).getTime()

        let index = frames.length - 1

        while (index > 0 && frames[index].start > timestamp) {
            index--
        }

        const bucket = buckets[index]

        if (!bucket) continue

        if (appointment.status === "completed") bucket.completed++
        else if (appointment.status === "missed") bucket.missed++
        else if (appointment.status === "cancelled") bucket.cancelled++
        else bucket.scheduled++
    }

    return buckets
}

export default async function AdminReportsPage({
    searchParams,
}: {
    searchParams: Promise<{ range?: string }>
}) {
    await requireRole("admin")

    const cookieStore = await cookies()

    const language: Language =
        cookieStore.get("clinicai-language")?.value === "ar" ? "ar" : "en"

    const monthDayYear = createDateFormatter(language, {
        month: "short",
        day: "numeric",
        year: "numeric",
    })

    const range = resolveRange((await searchParams).range)

    await connectDB()

    const [appointmentDocs, aiRuns, doctorRatings] = await Promise.all([
        Appointment.find({
            date: { $gte: range.prevStart, $lt: range.end },
        })
            .select("date time status type price doctor")
            .populate<{ doctor: PopulatedDoctor }>(
                "doctor",
                "name nameAr specialty rating"
            )
            .lean(),

        AIRun.find({
            mode: "patient",
            createdAt: { $gte: range.start, $lt: range.end },
        })
            .select("success durationMs knowledgeSearches knowledgeHits")
            .lean(),

        Doctor.find({ status: "active" })
            .select("rating reviews")
            .lean(),
    ])

    const startMs = range.start.getTime()
    const appointments = appointmentDocs as unknown as Appt[]

    const current = appointments.filter(
        (appointment) => new Date(appointment.date).getTime() >= startMs
    )

    const previous = appointments.filter(
        (appointment) => new Date(appointment.date).getTime() < startMs
    )

    const cur = summarize(current)
    const prev = summarize(previous)

    const visits = current.filter(
        (appointment) => appointment.status !== "cancelled"
    )

    const kpis: {
        title: string
        value: string
        icon: LucideIcon
        color: string
        bg: string
        delta?: Delta
        note: string
    }[] = [
        {
            title: "Booked Appointments",
            value: cur.booked.toLocaleString(
                language === "ar" ? "ar-LB" : "en-US"
            ),
            delta: changeDelta(cur.booked, prev.booked),
            note: `${cur.cancelled} ${t(language, "later cancelled")}`,
            icon: Calendar,
            color: "text-blue-600",
            bg: "bg-blue-100 dark:bg-blue-900/20",
        },
        {
            title: "Completion Rate",
            value: percent(cur.completionRate),
            delta: pointsDelta(cur.completionRate, prev.completionRate),
            note:
                cur.due > 0
                    ? `${cur.completed} ${t(language, "of")} ${cur.due} ${t(language, "due visits attended")}`
                    : t(language, "No visits came due"),
            icon: CalendarCheck,
            color: "text-emerald-600",
            bg: "bg-emerald-100 dark:bg-emerald-900/20",
        },
        {
            title: "Cancellation Rate",
            value: percent(cur.cancellationRate),
            delta: pointsDelta(cur.cancellationRate, prev.cancellationRate, false),
            note: `${cur.cancelled} ${t(language, "of")} ${cur.booked} ${t(language, "bookings")}`,
            icon: CalendarX,
            color: "text-orange-600",
            bg: "bg-orange-100 dark:bg-orange-900/20",
        },
        {
            title: "Revenue",
            value: money(cur.revenue, language),
            delta: changeDelta(
                cur.revenue,
                prev.revenue,
                true,
                (value) => money(value, language)
            ),
            note: t(language, "From completed visits"),
            icon: DollarSign,
            color: "text-purple-600",
            bg: "bg-purple-100 dark:bg-purple-900/20",
        },
    ]

    const aiSucceeded = aiRuns.filter((run) => run.success).length

    const aiSuccessRate =
        aiRuns.length > 0 ? aiSucceeded / aiRuns.length : null

    const aiAvgSeconds =
        aiRuns.length > 0
            ? aiRuns.reduce((sum, run) => sum + run.durationMs, 0) /
              aiRuns.length /
              1000
            : null

    const aiSearched = aiRuns.filter((run) => run.knowledgeSearches > 0)

    const aiAnswerRate =
        aiSearched.length > 0
            ? aiSearched.filter((run) => run.knowledgeHits > 0).length /
              aiSearched.length
            : null

    const byHour = new Map<number, number>()

    for (const appointment of visits) {
        const hour = Number.parseInt(appointment.time.slice(0, 2), 10)

        if (!Number.isNaN(hour)) {
            byHour.set(hour, (byHour.get(hour) ?? 0) + 1)
        }
    }

    const peak = [...byHour.entries()].sort(
        (a, b) => b[1] - a[1] || a[0] - b[0]
    )[0]

    const videoVisits = visits.filter(
        (appointment) => appointment.type === "video"
    ).length

    const videoShare =
        visits.length > 0 ? videoVisits / visits.length : null

    const reviewTotal = doctorRatings.reduce(
        (sum, doctor) => sum + (doctor.reviews ?? 0),
        0
    )

    const ratedDoctors = doctorRatings.filter(
        (doctor) => (doctor.rating ?? 0) > 0
    )

    const avgRating =
        reviewTotal > 0
            ? doctorRatings.reduce(
                  (sum, doctor) =>
                      sum +
                      (doctor.rating ?? 0) * (doctor.reviews ?? 0),
                  0
              ) / reviewTotal
            : ratedDoctors.length > 0
              ? ratedDoctors.reduce(
                    (sum, doctor) => sum + (doctor.rating ?? 0),
                    0
                ) / ratedDoctors.length
              : null

    const specialtyCounts = new Map<string, number>()

    for (const appointment of visits) {
        const specialty = appointment.doctor?.specialty ?? "Unknown"

        specialtyCounts.set(
            specialty,
            (specialtyCounts.get(specialty) ?? 0) + 1
        )
    }

    const specialties = [...specialtyCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, TOP_SPECIALTIES)

    const tally = (list: Appt[]) => {
        const map = new Map<
            string,
            {
                name: string
                nameAr: string
                specialty: string
                rating: number
                booked: number
                completed: number
            }
        >()

        for (const appointment of list) {
            if (appointment.status === "cancelled" || !appointment.doctor) {
                continue
            }

            const id = String(appointment.doctor._id)

            const entry = map.get(id) ?? {
                name: appointment.doctor.name ?? "Unknown doctor",
                nameAr: appointment.doctor.nameAr ?? "",
                specialty: appointment.doctor.specialty ?? "",
                rating: appointment.doctor.rating ?? 0,
                booked: 0,
                completed: 0,
            }

            entry.booked++

            if (appointment.status === "completed") {
                entry.completed++
            }

            map.set(id, entry)
        }

        return map
    }

    const previousByDoctor = tally(previous)

    const topDoctors = [...tally(current).entries()]
        .sort(
            (a, b) =>
                b[1].booked - a[1].booked ||
                b[1].completed - a[1].completed
        )
        .slice(0, TOP_DOCTORS)
        .map(([id, doctor]) => ({
            id,
            ...doctor,
            delta: changeDelta(
                doctor.booked,
                previousByDoctor.get(id)?.booked ?? 0
            ),
        }))

    const lastDay = new Date(range.end.getTime() - DAY_MS)

    return (
        <div
            className="space-y-8 animate-in fade-in duration-500"
            dir={language === "ar" ? "rtl" : "ltr"}
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {t(language, "Reports & Analytics")}
                    </h1>

                    <p className="text-muted-foreground mt-1">
                        {t(language, "Clinic performance for")}{" "}
                        {monthDayYear.format(range.start)} –{" "}
                        {monthDayYear.format(lastDay)}.
                    </p>
                </div>

                <a href={`/admin/reports/export?range=${range.key}`} download>
                    <Button className="h-11 px-6 shadow-lg shadow-blue-200 gap-2 font-bold">
                        <Download className="h-4 w-4" />
                        {t(language, "Export CSV")}
                    </Button>
                </a>
            </div>

            <nav
                className="flex flex-wrap gap-2"
                aria-label={t(language, "Report period")}
            >
                {RANGES.map((item) => (
                    <Link
                        key={item.key}
                        href={`/admin/reports?range=${item.key}`}
                        scroll={false}
                        aria-current={
                            item.key === range.key ? "page" : undefined
                        }
                        className={cn(
                            "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                            item.key === range.key
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-card border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {t(language, item.label)}
                    </Link>
                ))}
            </nav>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {kpis.map((kpi) => (
                    <Card
                        key={kpi.title}
                        className="border-none shadow-sm bg-card/60 backdrop-blur-sm group hover:shadow-md transition-all"
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {t(language, kpi.title)}
                            </CardTitle>

                            <div
                                className={`${kpi.bg} ${kpi.color} p-2 rounded-xl transition-transform group-hover:scale-110`}
                            >
                                <kpi.icon className="h-5 w-5" />
                            </div>
                        </CardHeader>

                        <CardContent>
                            <div className="text-2xl font-bold">
                                {kpi.value}
                            </div>

                            {kpi.delta && (
                                <DeltaLine
                                    delta={kpi.delta}
                                    period={t(language, range.prevLabel)}
                                    language={language}
                                />
                            )}

                            <p className="mt-1 text-xs text-muted-foreground">
                                {t(language, kpi.note)}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <Card className="lg:col-span-3 border-none bg-card shadow-sm overflow-hidden">
                    <CardHeader className="border-b bg-muted/20 px-8 py-6">
                        <CardTitle className="text-2xl">
                            {t(language, "Appointment Outcomes")}
                        </CardTitle>

                        <p className="text-sm text-muted-foreground mt-1">
                            {t(
                                language,
                                "What happened to appointments dated in this period, by"
                            )}{" "}
                            {t(language, range.bucket)}.
                        </p>
                    </CardHeader>

                    <CardContent className="p-8">
                        <OutcomesChart
                            buckets={outcomeBuckets(range, current, language)}
                        />
                    </CardContent>
                </Card>

                <Card className="border-none bg-card shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">
                            {t(language, "Key Metrics")}
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-7">
                        <Metric
                            label="AI reply success"
                            value={percent(aiSuccessRate)}
                            share={aiSuccessRate}
                            warn={
                                aiSuccessRate !== null &&
                                aiSuccessRate < AI_SUCCESS_WARN
                            }
                            note={
                                aiRuns.length > 0
                                    ? `${aiRuns.length} ${t(language, "replies")} · ${t(language, "avg")} ${aiAvgSeconds!.toFixed(1)}s`
                                    : t(language, "No patient chats in this period")
                            }
                            language={language}
                        />

                        <Metric
                            label="FAQ answer rate"
                            value={percent(aiAnswerRate)}
                            share={aiAnswerRate}
                            note={
                                aiSearched.length > 0
                                    ? `${aiSearched.length} ${t(language, "knowledge searches")}`
                                    : t(language, "No knowledge searches yet")
                            }
                            language={language}
                        />

                        <Metric
                            label="Video visits"
                            value={percent(videoShare)}
                            share={videoShare}
                            note={
                                visits.length > 0
                                    ? `${videoVisits} ${t(language, "video")} · ${visits.length - videoVisits} ${t(language, "in-person")}`
                                    : t(language, "No visits in this period")
                            }
                            language={language}
                        />

                        <Metric
                            label="Avg doctor rating"
                            value={
                                avgRating === null
                                    ? "—"
                                    : `${avgRating.toFixed(1)} / 5`
                            }
                            share={
                                avgRating === null ? null : avgRating / 5
                            }
                            note={
                                reviewTotal > 0
                                    ? `${reviewTotal.toLocaleString()} ${t(language, "reviews")} · ${t(language, "all time")}`
                                    : t(language, "All time")
                            }
                            language={language}
                        />

                        <div className="pt-6 border-t">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                                {t(language, "Busiest Hour")}
                            </p>

                            {peak ? (
                                <p className="text-sm">
                                    <span className="font-semibold">
                                        {to12h(peak[0], language)} –{" "}
                                        {to12h(peak[0] + 1, language)}
                                    </span>

                                    <span className="text-muted-foreground">
                                        {" "}
                                        · {peak[1]} {t(language, "of")}{" "}
                                        {visits.length} {t(language, "visits")}
                                    </span>
                                </p>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {t(language, "No visits in this period")}
                                    .
                                </p>
                            )}
                        </div>

                        <div className="pt-6 border-t">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
                                {t(language, "Popular Specialties")}
                            </p>

                            {specialties.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {t(language, "No visits in this period")}.
                                </p>
                            ) : (
                                <ul className="space-y-3">
                                    {specialties.map(([name, count]) => (
                                        <li
                                            key={name}
                                            className="space-y-1.5"
                                            title={`${name}: ${count} ${t(language, "of")} ${visits.length} ${t(language, "visits")}`}
                                        >
                                            <div className="flex items-center justify-between gap-2 text-sm">
                                                <span className="truncate">
                                                    {t(language, name)}
                                                </span>

                                                <span className="text-xs font-bold tabular-nums">
                                                    {Math.round(
                                                        (count / visits.length) *
                                                            100
                                                    )}
                                                    %
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

            <Card className="border-none bg-card shadow-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b px-8 py-6">
                    <div>
                        <CardTitle className="text-xl">
                            {t(language, "Most Booked Doctors")}
                        </CardTitle>

                        <p className="text-sm text-muted-foreground mt-1">
                            {t(
                                language,
                                "Ranked by appointments in this period, excluding cancellations; change vs"
                            )}{" "}
                            {t(language, range.prevLabel)}.
                        </p>
                    </div>

                    <Link href="/admin/doctors">
                        <Button
                            variant="ghost"
                            className="text-primary font-bold"
                        >
                            {t(language, "Manage Doctors")}
                        </Button>
                    </Link>
                </CardHeader>

                <CardContent className="p-0">
                    {topDoctors.length === 0 ? (
                        <p className="p-12 text-center text-sm text-muted-foreground">
                            {t(language, "No appointments in this period")}.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-muted/50">
                            {topDoctors.map((doctor) => (
                                <div
                                    key={doctor.id}
                                    className="p-8 hover:bg-muted/10 transition-colors group"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center border-2 border-background shadow-sm overflow-hidden group-hover:scale-110 transition-transform">
                                            <Users className="h-6 w-6 text-primary" />
                                        </div>

                                        <Badge
                                            variant={
                                                doctor.delta.good === null
                                                    ? "secondary"
                                                    : doctor.delta.good
                                                      ? "success"
                                                      : "destructive"
                                            }
                                            className="text-[10px]"
                                        >
                                            {doctor.delta.text}
                                        </Badge>
                                    </div>

                                    <h4 className="font-bold text-lg mb-1">
                                         {language === "ar" && doctor.nameAr?.trim()
        ? doctor.nameAr
        : doctor.name}
                                    </h4>

                                    <p className="text-primary text-xs font-bold uppercase tracking-tight mb-4">
                                        {t(language, doctor.specialty)}
                                    </p>

                                    <div className="flex items-center justify-between text-sm">
                                        <div
                                            className="flex items-center text-muted-foreground font-medium"
                                            title={`${doctor.completed} ${t(language, "completed")}`}
                                        >
                                            <Calendar className="h-3.5 w-3.5 mr-1" />
                                            {doctor.booked} {t(language, "booked")} ·{" "}
                                            {doctor.completed} {t(language, "done")}
                                        </div>

                                        <div className="flex items-center font-bold">
                                            <Star className="h-3.5 w-3.5 mr-1 text-amber-500 fill-amber-500" />
                                            {doctor.rating
                                                ? doctor.rating.toFixed(1)
                                                : "—"}
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

function DeltaLine({
    delta,
    period,
    language,
}: {
    delta: Delta
    period: string
    language: Language
}) {
    const Icon =
        delta.direction === "up"
            ? ArrowUpRight
            : delta.direction === "down"
              ? ArrowDownRight
              : Minus

    const tone =
        delta.good === null
            ? "text-muted-foreground"
            : delta.good
              ? "text-emerald-600"
              : "text-destructive"

    return (
        <div className="flex items-center mt-1">
            <Icon className={cn("h-4 w-4 mr-1", tone)} />

            <span className={cn("font-medium text-xs", tone)}>
                {delta.text}
            </span>

            <span className="text-[10px] text-muted-foreground ml-1">
                {t(language, "vs")} {period}
            </span>
        </div>
    )
}

function Metric({
    label,
    value,
    share,
    note,
    warn = false,
    language,
}: {
    label: string
    value: string
    share: number | null
    note: string
    warn?: boolean
    language: Language
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t(language, label)}
                </span>

                <span className="text-sm font-bold">
                    {value}

                    {warn && (
                        <span className="ml-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                            {t(language, "Low")}
                        </span>
                    )}
                </span>
            </div>

            <Bar
                share={share ?? 0}
                warn={warn}
                label={`${t(language, label)}: ${value}`}
            />

            <p className="mt-1.5 text-[11px] text-muted-foreground">
                {note}
            </p>
        </div>
    )
}

function Bar({
    share,
    warn = false,
    label,
}: {
    share: number
    warn?: boolean
    label?: string
}) {
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
                warn
                    ? "bg-amber-100 dark:bg-amber-950"
                    : "bg-blue-100 dark:bg-blue-950"
            )}
        >
            {pct > 0 && (
                <div
                    className={cn(
                        "h-full rounded-full",
                        warn
                            ? "bg-amber-500"
                            : "bg-blue-600 dark:bg-blue-500"
                    )}
                    style={{ width: `${pct}%` }}
                />
            )}
        </div>
    )
}