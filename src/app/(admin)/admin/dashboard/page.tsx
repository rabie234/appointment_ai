import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Users,
    Calendar,
    UserPlus,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    ArrowRight,
    Minus,
    type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import { dayOfWeek, normalizeWeek, slotsForDay } from "@/lib/schedule"
import Appointment, { type IAppointment } from "@/models/Appointment"
import Doctor from "@/models/Doctor"
import User from "@/models/User"
import {
    DashboardText,
    DashboardStatNote,
} from "./dashboard-translations"
// Every number here is live; never serve a cached snapshot.
export const dynamic = "force-dynamic"

const DAY_MS = 24 * 60 * 60 * 1000
/** A patient counts as active with a visit in this many past days, or one upcoming. */
const ACTIVE_PATIENT_DAYS = 90
/** Window used for the "vs previous period" comparisons. */
const COMPARE_DAYS = 30
/** Upcoming-appointments table length. */
const UPCOMING_LIMIT = 6
/** Daily capacity at or above this share is flagged as nearly full. */
const NEARLY_FULL = 0.9

type Status = IAppointment["status"]

const STATUS_LABEL: Record<Status, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    "in-progress": "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
    missed: "Missed",
}

function badgeVariant(status: Status) {
    switch (status) {
        case "confirmed":
        case "in-progress":
            return "default" as const
        case "pending":
            return "secondary" as const
        case "completed":
            return "success" as const
        case "cancelled":
        case "missed":
            return "destructive" as const
    }
}

function to12h(time: string): string {
    const [h, m] = time.split(":").map(Number)
    if (Number.isNaN(h)) return time
    const period = h >= 12 ? "PM" : "AM"
    const hour12 = h % 12 === 0 ? 12 : h % 12
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

// Appointment dates are stored as UTC midnight, so format them in UTC.
const shortDay = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" })
const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })

type Delta = { text: string; direction: "up" | "down" | "flat"; period: string }

/** Signed change of `current` against `previous`, as a percentage when possible. */
function delta(current: number, previous: number, period: string): Delta {
    if (previous === 0) {
        return current === 0
            ? { text: "No change", direction: "flat", period }
            : { text: `+${current.toLocaleString()}`, direction: "up", period }
    }
    const pct = Math.round(((current - previous) / previous) * 100)
    if (pct === 0) return { text: "0%", direction: "flat", period }
    return { text: `${pct > 0 ? "+" : ""}${pct}%`, direction: pct > 0 ? "up" : "down", period }
}

type Stat = {
    title: string
    value: number
    icon: LucideIcon
    color: string
    bg: string
    delta?: Delta
    note?: string
}

type UpcomingRow = {
    id: string
    patient: string
    doctor: string
    specialty: string
    when: string
    status: Status
}

type CapacityDay = {
    key: string
    label: string
    date: string
    booked: number
    slots: number
    isToday: boolean
}

type PopulatedName = { name?: string; specialty?: string } | null

export default async function AdminDashboardPage() {
    const session = await requireRole("admin")
    await connectDB()

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const tomorrow = new Date(today.getTime() + DAY_MS)
    const dayAfter = new Date(today.getTime() + 2 * DAY_MS)
    const now = new Date()
    const compareStart = new Date(now.getTime() - COMPARE_DAYS * DAY_MS)
    const comparePrevStart = new Date(now.getTime() - 2 * COMPARE_DAYS * DAY_MS)
    const activeSince = new Date(today.getTime() - ACTIVE_PATIENT_DAYS * DAY_MS)
    // The current Monday-to-Sunday week.
    const weekStart = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY_MS)
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS)

    const notCancelled = { status: { $ne: "cancelled" } }

    const [
        activeDoctors,
        inactiveDoctors,
        totalAppointments,
        bookedRecently,
        bookedPreviously,
        todayDocs,
        activePatientIds,
        registeredPatients,
        newPatients,
        upcomingDocs,
        upcomingTotal,
        weekCounts,
    ] = await Promise.all([
        Doctor.find({ status: "active" }).select("schedule availability").lean(),
        Doctor.countDocuments({ status: "inactive" }),
        Appointment.countDocuments(notCancelled),
        // Same population as the total (cancelled excluded), so the delta and value agree.
        Appointment.countDocuments({ createdAt: { $gte: compareStart }, ...notCancelled }),
        Appointment.countDocuments({ createdAt: { $gte: comparePrevStart, $lt: compareStart }, ...notCancelled }),
        Appointment.find({ date: { $gte: today, $lt: tomorrow }, ...notCancelled }).select("status").lean(),
        Appointment.distinct("patient", { date: { $gte: activeSince }, ...notCancelled }),
        User.countDocuments({ role: "patient" }),
        User.countDocuments({ role: "patient", createdAt: { $gte: compareStart } }),
        Appointment.find({
            date: { $gte: today, $lt: dayAfter },
            status: { $in: ["pending", "confirmed", "in-progress"] },
        })
            .populate<{ patient: PopulatedName }>("patient", "name")
            .populate<{ doctor: PopulatedName }>("doctor", "name specialty")
            .sort({ date: 1, time: 1 })
            .limit(UPCOMING_LIMIT)
            .lean(),
        Appointment.countDocuments({
            date: { $gte: today, $lt: dayAfter },
            status: { $in: ["pending", "confirmed", "in-progress"] },
        }),
        Appointment.aggregate<{ _id: Date; count: number }>([
            { $match: { date: { $gte: weekStart, $lt: weekEnd }, ...notCancelled } },
            { $group: { _id: "$date", count: { $sum: 1 } } },
        ]),
    ])

    // ── Stat tiles ──────────────────────────────────────────────────────────

    const onLeave = activeDoctors.filter((d) => d.availability === "on-leave").length
    const todayCompleted = todayDocs.filter((a) => a.status === "completed").length
    const todayRemaining = todayDocs.filter(
        (a) => a.status === "pending" || a.status === "confirmed" || a.status === "in-progress"
    ).length

    const stats: Stat[] = [
        {
            title: "Active Doctors",
            value: activeDoctors.length,
            note: `${onLeave} on leave · ${inactiveDoctors} inactive`,
            icon: Users,
            color: "text-blue-600",
            bg: "bg-blue-100 dark:bg-blue-900/20"
        },
        {
            title: "Total Appointments",
            value: totalAppointments,
            delta: delta(bookedRecently, bookedPreviously, `bookings vs previous ${COMPARE_DAYS} days`),
            icon: Calendar,
            color: "text-emerald-600",
            bg: "bg-emerald-100 dark:bg-emerald-900/20"
        },
        {
            title: "Today's Appointments",
            value: todayDocs.length,
            note: `${todayCompleted} completed · ${todayRemaining} to go`,
            icon: Activity,
            color: "text-purple-600",
            bg: "bg-purple-100 dark:bg-purple-900/20"
        },
        {
            title: "Active Patients",
            value: activePatientIds.length,
            note: `of ${registeredPatients.toLocaleString()} registered · ${newPatients} new in ${COMPARE_DAYS} days`,
            icon: UserPlus,
            color: "text-orange-600",
            bg: "bg-orange-100 dark:bg-orange-900/20"
        },
    ]

    // ── Upcoming appointments (today + tomorrow) ────────────────────────────

    const upcoming: UpcomingRow[] = upcomingDocs.map((a) => {
        const day = new Date(a.date).getTime() === today.getTime() ? "Today" : "Tomorrow"
        return {
            id: String(a._id),
            patient: a.patient?.name ?? "Unknown patient",
            doctor: a.doctor?.name ?? "Unknown doctor",
            specialty: a.doctor?.specialty ?? "",
            when: `${day}, ${to12h(a.time)}`,
            status: a.status,
        }
    })

    // ── This week's capacity: booked slots vs slots doctors' schedules allow ─

    const schedules = activeDoctors.map((d) => normalizeWeek(d.schedule))
    const bookedByDay = new Map(weekCounts.map((w) => [new Date(w._id).toISOString().slice(0, 10), w.count]))

    const week: CapacityDay[] = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(weekStart.getTime() + i * DAY_MS)
        const key = date.toISOString().slice(0, 10)
        // Same weekday lookup the booking flow uses to generate slots.
        const weekday = dayOfWeek(date)
        const slots = schedules.reduce((sum, schedule) => {
            const entry = schedule.find((s) => s.day === weekday)
            return sum + (entry ? slotsForDay(entry).length : 0)
        }, 0)
        return {
            key,
            label: shortDay.format(date),
            date: monthDay.format(date),
            booked: bookedByDay.get(key) ?? 0,
            slots,
            isToday: date.getTime() === today.getTime(),
        }
    })

    const weekBooked = week.reduce((sum, d) => sum + d.booked, 0)
    const weekSlots = week.reduce((sum, d) => sum + d.slots, 0)

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight"><DashboardText text="Dashboard Overview" /></h1>
                    <p className="text-muted-foreground mt-1">
                        <DashboardText text="Welcome back" />, {session.user.name ?? "Admin"}. <DashboardText text="Here's what's happening today." />
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/admin/reports" className="hidden sm:flex">
                        <Button variant="outline"><DashboardText text="View Reports" /></Button>
                    </Link>
                    <Link href="/admin/appointments">
                        <Button className="shadow-lg shadow-blue-200"><DashboardText text="Manage Appointments" /></Button>
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <Card key={stat.title} className="border-none shadow-sm bg-card/60 backdrop-blur-sm group hover:shadow-md transition-all">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground"><DashboardText text={stat.title} /></CardTitle>
                            <div className={`${stat.bg} ${stat.color} p-2 rounded-xl transition-transform group-hover:scale-110`}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
                            {stat.delta ? (
                                <DeltaLine delta={stat.delta} />
                           ) : stat.note ? (
    <p className="mt-1 text-xs text-muted-foreground">
        {stat.title === "Active Doctors" && (
            <DashboardStatNote
                kind="doctors"
                first={onLeave}
                second={inactiveDoctors}
            />
        )}

        {stat.title === "Today's Appointments" && (
            <DashboardStatNote
                kind="today"
                first={todayCompleted}
                second={todayRemaining}
            />
        )}

        {stat.title === "Active Patients" && (
            <DashboardStatNote
                kind="patients"
                first={registeredPatients}
                second={newPatients}
                third={COMPARE_DAYS}
            />
        )}
    </p>
) : null}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Upcoming Appointments Table */}
                <Card className="lg:col-span-2 border-none shadow-sm bg-card/60">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-xl"><DashboardText text="Upcoming Appointments" /></CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                {upcomingTotal === 0
                                    ? <DashboardText text="Nothing scheduled for today or tomorrow." />
                                    : <><span>{upcomingTotal} </span><DashboardText text="scheduled for today and tomorrow." /></>}
                            </p>
                        </div>
                        <Link href="/admin/appointments">
                            <Button variant="ghost" size="sm" className="text-primary font-bold"><DashboardText text="View All" /></Button>
                        </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-muted/50">
                                    <TableHead className="pl-6"><DashboardText text="Patient" /></TableHead>
                                    <TableHead><DashboardText text="Doctor" /></TableHead>
                                    <TableHead><DashboardText text="Date & Time" /></TableHead>
                                    <TableHead><DashboardText text="Status" /></TableHead>
                                    <TableHead className="text-right pr-6"><DashboardText text="Action" /></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {upcoming.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                            <DashboardText text="No upcoming appointments in the next two days." />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    upcoming.map((app) => (
                                        <TableRow key={app.id} className="group hover:bg-accent/50 transition-colors border-muted/30">
                                            <TableCell className="pl-6 font-medium">{app.patient}</TableCell>
                                            <TableCell>
                                                <span className="text-muted-foreground font-medium block">{app.doctor}</span>
                                                {app.specialty && (
                                                    <span className="text-xs text-muted-foreground/80">{app.specialty}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs font-semibold">{app.when}</TableCell>
                                            <TableCell>
                                                <Badge variant={badgeVariant(app.status)}><DashboardText text={STATUS_LABEL[app.status]} /></Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Link href="/admin/appointments" title="Manage in Appointments">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors">
                                                        <ArrowRight className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Weekly Capacity Card */}
                <Card className="border-none shadow-sm bg-card/60 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Activity className="h-32 w-32 text-primary" />
                    </div>
                    <CardHeader>
                        <CardTitle className="text-xl">
    <DashboardText text="This Week's Capacity" />
</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            {weekSlots === 0
                                ? <DashboardText text="No doctor working hours are set for this week." />
                                : <><span>{weekBooked} / {weekSlots} </span><DashboardText text="slots booked" /> ({Math.round((weekBooked / weekSlots) * 100)}%).</>}
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-5 mt-2">
                            {week.map((day) => (
                                <CapacityMeter key={day.key} day={day} />
                            ))}
                        </div>
                        <Link href="/admin/reports">
                            <Button variant="outline" className="w-full mt-8 border-primary/20 text-primary hover:bg-primary/5">
                                <DashboardText text="View Full Reports" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

/** Change vs a named period. Up is good for every metric that uses this. */
function DeltaLine({ delta }: { delta: Delta }) {
    const Icon = delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : Minus
    const tone =
        delta.direction === "up"
            ? "text-emerald-600"
            : delta.direction === "down"
                ? "text-destructive"
                : "text-muted-foreground"
    return (
        <div className="flex items-center mt-1">
            <Icon className={cn("h-4 w-4 mr-1", tone)} />
            <span className={cn("font-medium text-xs", tone)}>{delta.text}</span>
            <span className="text-[10px] text-muted-foreground ml-1">{delta.period}</span>
        </div>
    )
}

/** One day's booked share of bookable slots; amber once it is nearly full. */
function CapacityMeter({ day }: { day: CapacityDay }) {
    const closed = day.slots === 0
    const share = closed ? 0 : Math.min(day.booked / day.slots, 1)
    const pct = Math.round(share * 100)
    const nearlyFull = !closed && share >= NEARLY_FULL
    const summary = closed
        ? `${day.label}, ${day.date}: no working hours`
        : `${day.label}, ${day.date}: ${day.booked} of ${day.slots} slots booked (${pct}%)`

    return (
        <div className="space-y-2" title={summary}>
            <div className="flex justify-between items-center text-xs">
                <span className="font-bold uppercase tracking-wider flex items-center gap-2">
                    {day.label}
                    <span className="font-normal normal-case tracking-normal text-muted-foreground">{day.date}</span>
                    {day.isToday && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-primary">
                            <DashboardText text="Today" />
                        </span>
                    )}
                </span>
                <span className="text-muted-foreground">
                    {closed ? (
                        <DashboardText text="Closed" />
                    ) : (
                        <>
                            {day.booked}/{day.slots} · {pct}%
                            {nearlyFull && <span className="ml-1 font-semibold text-amber-700 dark:text-amber-400"><DashboardText text={pct === 100 ? "Full" : "Nearly full"} /></span>}
                        </>
                    )}
                </span>
            </div>
            <div
                role="meter"
                aria-label={summary}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                className={cn(
                    "h-2 w-full rounded-full overflow-hidden",
                    closed ? "bg-muted" : nearlyFull ? "bg-amber-100 dark:bg-amber-950" : "bg-blue-100 dark:bg-blue-950"
                )}
            >
                {pct > 0 && (
                    <div
                        className={cn("h-full rounded-full", nearlyFull ? "bg-amber-500" : "bg-blue-600 dark:bg-blue-500")}
                        style={{ width: `${pct}%` }}
                    />
                )}
            </div>
        </div>
    )
}
