import Link from "next/link"
import { notFound } from "next/navigation"
import { isValidObjectId } from "mongoose"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Star,
    MapPin,
    ChevronLeft,
    ShieldCheck,
    Award,
    BookOpen,
} from "lucide-react"
import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import { normalizeWeek } from "@/lib/schedule"
import Doctor from "@/models/Doctor"
import { BookingPanel } from "./booking-panel"

export const dynamic = "force-dynamic"

const CONSULTATION_FEE = 120

function formatHours(open: string, close: string): string {
    return `${to12h(open)} - ${to12h(close)}`
}

function to12h(time: string): string {
    const [h, m] = time.split(":").map(Number)
    const period = h >= 12 ? "PM" : "AM"
    const hour12 = h % 12 === 0 ? 12 : h % 12
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

export default async function DoctorProfilePage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    await requireRole("patient")
    const { id } = await params

    if (!isValidObjectId(id)) notFound()

    await connectDB()
    const doctor = await Doctor.findById(id).lean()
    if (!doctor) notFound()

    const schedule = normalizeWeek(doctor.schedule)
    const workingDays = schedule.filter((d) => !d.closed)
    const isActive = doctor.status === "active"

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <Link
                href="/doctors"
                className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back to search
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Info */}
                <div className="lg:col-span-2 space-y-8">
                    <section className="flex flex-col md:flex-row gap-6 md:items-end">
                        <div className="h-32 w-32 rounded-2xl bg-muted overflow-hidden border-4 border-card shadow-xl flex-shrink-0 flex items-center justify-center">
                            {doctor.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={doctor.image} alt={doctor.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-4xl font-bold text-primary/40">
                                    {doctor.name.replace(/^Dr\.?\s*/i, "").charAt(0)}
                                </span>
                            )}
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold tracking-tight">{doctor.name}</h1>
                                <Badge variant={doctor.availability === "available" ? "success" : "secondary"}>
                                    {doctor.availability === "available" ? "Available" : "On Leave"}
                                </Badge>
                            </div>
                            <p className="text-primary font-semibold text-lg">{doctor.specialty}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center">
                                    <Star className="h-4 w-4 text-amber-500 fill-current mr-1" />
                                    <span className="font-bold text-foreground">{doctor.rating.toFixed(1)}</span>
                                    <span className="ml-1">({doctor.reviews} reviews)</span>
                                </div>
                                <div className="flex items-center">
                                    <MapPin className="h-4 w-4 text-primary mr-1" />
                                    Downtown Medical Center
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatCard
                            icon={<ShieldCheck className="h-5 w-5" />}
                            tone="blue"
                            label="Experience"
                            value={doctor.experience || "—"}
                        />
                        <StatCard
                            icon={<Award className="h-5 w-5" />}
                            tone="emerald"
                            label="Success Rate"
                            value={`${doctor.successRate}%`}
                        />
                        <StatCard
                            icon={<BookOpen className="h-5 w-5" />}
                            tone="orange"
                            label="Total Patients"
                            value={doctor.totalPatients.toLocaleString()}
                        />
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold">Working Hours</h2>
                        <div className="bg-card/50 rounded-xl border overflow-hidden">
                            {workingDays.length === 0 ? (
                                <p className="px-6 py-4 text-sm text-muted-foreground">
                                    No working hours set for this doctor yet.
                                </p>
                            ) : (
                                <table className="w-full text-sm">
                                    <tbody className="divide-y">
                                        {workingDays.map((item) => (
                                            <tr key={item.day} className="hover:bg-accent/50 transition-colors">
                                                <td className="px-6 py-3 font-medium">{item.day}</td>
                                                <td className="px-6 py-3 text-muted-foreground">
                                                    {formatHours(item.open, item.close)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </section>
                </div>

                {/* Booking Sidebar */}
                <div className="space-y-6">
                    <BookingPanel doctorId={String(doctor._id)} fee={CONSULTATION_FEE} active={isActive} />
                </div>
            </div>
        </div>
    )
}

function StatCard({
    icon,
    tone,
    label,
    value,
}: {
    icon: React.ReactNode
    tone: "blue" | "emerald" | "orange"
    label: string
    value: string
}) {
    const tones = {
        blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
        emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
        orange: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    }
    return (
        <Card className="bg-card/50 border-none shadow-sm">
            <CardContent className="p-4 flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${tones[tone]}`}>{icon}</div>
                <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-bold">{value}</p>
                </div>
            </CardContent>
        </Card>
    )
}
