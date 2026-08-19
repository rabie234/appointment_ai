"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
    Calendar,
    Clock,
    MapPin,
    User,
    Video,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type AppointmentCard = {
    id: string
    doctor: string
    specialty: string
    date: string
    time: string
    /** UI bucket derived from the stored status. */
    tab: "Upcoming" | "Completed" | "Cancelled"
    statusLabel: string
    type: "video" | "in-person"
    price: string
}

const TABS = ["Upcoming", "Completed", "Cancelled"] as const

export function AppointmentsList({ appointments }: { appointments: AppointmentCard[] }) {
    const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Upcoming")

    const filtered = appointments.filter((a) => a.tab === activeTab)

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Appointments</h1>
                    <p className="text-muted-foreground mt-1">Manage and track your medical visits.</p>
                </div>
                <Link href="/doctors">
                    <Button className="shadow-lg shadow-blue-100">Book New Appointment</Button>
                </Link>
            </div>

            <div className="flex bg-card/60 p-1 rounded-xl border border-none shadow-sm w-fit">
                {TABS.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "px-6 py-2 rounded-lg text-sm font-medium transition-all",
                            activeTab === tab
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filtered.length > 0 ? (
                    filtered.map((app) => (
                        <Card key={app.id} className="border-none shadow-sm bg-card/60 overflow-hidden group hover:shadow-md transition-all">
                            <CardContent className="p-0">
                                <div className="flex flex-col md:flex-row items-stretch">
                                    <div
                                        className={cn(
                                            "w-full md:w-2 bg-primary",
                                            app.tab === "Completed" && "bg-emerald-500",
                                            app.tab === "Cancelled" && "bg-destructive"
                                        )}
                                    />
                                    <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center gap-6">
                                        <div className="flex items-center space-x-4 flex-1">
                                            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center border-2 border-background shadow-md">
                                                <User className="h-8 w-8 text-primary" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-bold">{app.doctor}</h3>
                                                    <Badge
                                                        variant={
                                                            app.tab === "Upcoming"
                                                                ? "default"
                                                                : app.tab === "Completed"
                                                                ? "success"
                                                                : "destructive"
                                                        }
                                                    >
                                                        {app.statusLabel}
                                                    </Badge>
                                                </div>
                                                <p className="text-primary text-sm font-medium">{app.specialty}</p>
                                                <div className="flex flex-wrap items-center mt-3 gap-x-6 gap-y-2 text-sm text-muted-foreground font-medium">
                                                    <div className="flex items-center">
                                                        <Calendar className="mr-1.5 h-4 w-4 text-primary" />
                                                        {app.date}
                                                    </div>
                                                    <div className="flex items-center">
                                                        <Clock className="mr-1.5 h-4 w-4 text-primary" />
                                                        {app.time}
                                                    </div>
                                                    <div className="flex items-center">
                                                        {app.type === "video" ? (
                                                            <Video className="mr-1.5 h-4 w-4 text-blue-500" />
                                                        ) : (
                                                            <MapPin className="mr-1.5 h-4 w-4 text-orange-500" />
                                                        )}
                                                        {app.type === "video" ? "Video Call" : "In-Person"}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 text-right">
                                            <span className="font-bold text-lg">{app.price}</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="py-20 text-center animate-in fade-in slide-in-from-top-4">
                        <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                            <Calendar className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-bold">No appointments found</h3>
                        <p className="text-muted-foreground mt-2 max-w-xs mx-auto">
                            You don&apos;t have any appointments in this category. Why not book one today?
                        </p>
                        <Link href="/doctors">
                            <Button className="mt-8">Book an Appointment</Button>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}
