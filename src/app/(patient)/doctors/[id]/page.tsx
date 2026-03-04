"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Star,
    MapPin,
    Clock,
    ChevronLeft,
    Calendar as CalendarIcon,
    ShieldCheck,
    Award,
    BookOpen
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { cn } from "@/lib/utils"

const timeSlots = [
    "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
    "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM"
]

const workedDays = [
    { day: "Monday", hours: "09:00 AM - 05:00 PM" },
    { day: "Tuesday", hours: "09:00 AM - 05:00 PM" },
    { day: "Wednesday", hours: "09:00 AM - 05:00 PM" },
    { day: "Thursday", hours: "09:00 AM - 05:00 PM" },
    { day: "Friday", hours: "09:00 AM - 01:00 PM" },
]

export default function DoctorProfilePage({ params }: { params: { id: string } }) {
    const [selectedDate, setSelectedDate] = useState("Mar 12, 2026")
    const [selectedTime, setSelectedTime] = useState<string | null>(null)

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <Link href="/doctors" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back to search
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Info */}
                <div className="lg:col-span-2 space-y-8">
                    <section className="flex flex-col md:flex-row gap-6 md:items-end">
                        <div className="h-32 w-32 rounded-2xl bg-muted overflow-hidden border-4 border-card shadow-xl flex-shrink-0">
                            <img
                                src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=300&auto=format&fit=crop"
                                alt="Doctor"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold tracking-tight">Dr. Sarah Johnson</h1>
                                <Badge variant="success">Available Today</Badge>
                            </div>
                            <p className="text-primary font-semibold text-lg">Cardiologist - Senior Heart Specialist</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center">
                                    <Star className="h-4 w-4 text-amber-500 fill-current mr-1" />
                                    <span className="font-bold text-foreground">4.9</span> (124 reviews)
                                </div>
                                <div className="flex items-center">
                                    <MapPin className="h-4 w-4 text-primary mr-1" />
                                    New York Medical Center
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-card/50 border-none shadow-sm">
                            <CardContent className="p-4 flex items-center space-x-3">
                                <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Experience</p>
                                    <p className="text-sm font-bold">12+ Years</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-card/50 border-none shadow-sm">
                            <CardContent className="p-4 flex items-center space-x-3">
                                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    <Award className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Success Rate</p>
                                    <p className="text-sm font-bold">98%</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-card/50 border-none shadow-sm">
                            <CardContent className="p-4 flex items-center space-x-3">
                                <div className="p-2 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                                    <BookOpen className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Total Patients</p>
                                    <p className="text-sm font-bold">5,000+</p>
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold">About Dr. Johnson</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Dr. Sarah Johnson is a highly experienced cardiologist specializing in non-invasive cardiac imaging and preventive cardiology.
                            She earned her medical degree from Johns Hopkins University and has been practicing for over 12 years.
                            She is dedicated to providing personalized care to her patients and is known for her approachable and thorough consultation style.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold">Working Hours</h2>
                        <div className="bg-card/50 rounded-xl border overflow-hidden">
                            <table className="w-full text-sm">
                                <tbody className="divide-y">
                                    {workedDays.map(item => (
                                        <tr key={item.day} className="hover:bg-accent/50 transition-colors">
                                            <td className="px-6 py-3 font-medium">{item.day}</td>
                                            <td className="px-6 py-3 text-muted-foreground">{item.hours}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                {/* Booking Sidebar */}
                <div className="space-y-6">
                    <Card className="sticky top-24 border-none shadow-lg bg-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5 text-primary" />
                                Book Appointment
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <p className="text-sm font-semibold mb-3 tracking-tight">Select Date</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {["Mar 10", "Mar 11", "Mar 12", "Mar 13", "Mar 14", "Mar 15"].map(date => (
                                        <button
                                            key={date}
                                            onClick={() => setSelectedDate(date)}
                                            className={cn(
                                                "px-2 py-2 text-xs rounded-lg border transition-all",
                                                selectedDate.includes(date)
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "hover:border-primary hover:text-primary"
                                            )}
                                        >
                                            {date}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="text-sm font-semibold mb-3 tracking-tight">Select Time Slot</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {timeSlots.map(time => (
                                        <button
                                            key={time}
                                            onClick={() => setSelectedTime(time)}
                                            className={cn(
                                                "px-3 py-2 text-xs rounded-lg border transition-all",
                                                selectedTime === time
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "hover:border-primary hover:text-primary"
                                            )}
                                        >
                                            {time}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 border-t space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Consultation Fee</span>
                                    <span className="font-bold text-lg">$120.00</span>
                                </div>
                                <Button className="w-full py-6 text-lg shadow-xl shadow-blue-200" disabled={!selectedTime}>
                                    Book Now
                                </Button>
                                <p className="text-[10px] text-center text-muted-foreground px-4">
                                    You won't be charged yet. Payment is handled at the clinic.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
