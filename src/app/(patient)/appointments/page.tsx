"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Calendar,
    Clock,
    MapPin,
    User,
    Video,
    MoreVertical,
    ChevronRight,
    FileText
} from "lucide-react"
import { cn } from "@/lib/utils"

const appointments = [
    {
        id: 1,
        doctor: "Dr. Sarah Johnson",
        specialty: "Cardiology",
        date: "Mar 12, 2026",
        time: "10:30 AM",
        status: "Upcoming",
        type: "Video Call",
        price: "$120.00",
    },
    {
        id: 2,
        doctor: "Dr. Michael Chen",
        specialty: "Neurology",
        date: "Feb 28, 2026",
        time: "02:00 PM",
        status: "Completed",
        type: "In-Person",
        price: "$150.00",
    },
    {
        id: 3,
        doctor: "Dr. Emily Smith",
        specialty: "Dermatology",
        date: "Feb 15, 2026",
        time: "11:00 AM",
        status: "Cancelled",
        type: "In-Person",
        price: "$100.00",
    },
]

export default function MyAppointmentsPage() {
    const [activeTab, setActiveTab] = useState("Upcoming")

    const filteredAppointments = appointments.filter(app => app.status === activeTab)

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Appointments</h1>
                    <p className="text-muted-foreground mt-1">Manage and track your medical visits.</p>
                </div>
                <Button className="shadow-lg shadow-blue-100">
                    Book New Appointment
                </Button>
            </div>

            <div className="flex bg-card/60 p-1 rounded-xl border border-none shadow-sm w-fit">
                {["Upcoming", "Completed", "Cancelled"].map(tab => (
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
                {filteredAppointments.length > 0 ? (
                    filteredAppointments.map(app => (
                        <Card key={app.id} className="border-none shadow-sm bg-card/60 overflow-hidden group hover:shadow-md transition-all">
                            <CardContent className="p-0">
                                <div className="flex flex-col md:flex-row items-stretch">
                                    <div className={cn(
                                        "w-full md:w-2 bg-primary",
                                        app.status === "Completed" && "bg-emerald-500",
                                        app.status === "Cancelled" && "bg-destructive"
                                    )} />
                                    <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center gap-6">
                                        <div className="flex items-center space-x-4 flex-1">
                                            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center border-2 border-background shadow-md">
                                                <User className="h-8 w-8 text-primary" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-bold">{app.doctor}</h3>
                                                    <Badge variant={app.status === "Upcoming" ? "default" : app.status === "Completed" ? "success" : "destructive"}>
                                                        {app.status}
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
                                                        {app.type === "Video Call" ? (
                                                            <Video className="mr-1.5 h-4 w-4 text-blue-500" />
                                                        ) : (
                                                            <MapPin className="mr-1.5 h-4 w-4 text-orange-500" />
                                                        )}
                                                        {app.type}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {app.status === "Upcoming" && (
                                                <>
                                                    <Button variant="outline" size="sm" className="hidden sm:inline-flex">
                                                        Reschedule
                                                    </Button>
                                                    <Button size="sm">
                                                        {app.type === "Video Call" ? "Join Call" : "View Map"}
                                                    </Button>
                                                </>
                                            )}
                                            {app.status === "Completed" && (
                                                <>
                                                    <Button variant="outline" size="sm" className="space-x-2">
                                                        <FileText className="h-4 w-4" />
                                                        <span>Report</span>
                                                    </Button>
                                                    <Button size="sm">Book Again</Button>
                                                </>
                                            )}
                                            {app.status === "Cancelled" && (
                                                <Button size="sm">Rebook</Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="text-muted-foreground h-9 w-9">
                                                <MoreVertical className="h-5 w-5" />
                                            </Button>
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
                            You don't have any appointments in this category. Why not book one today?
                        </p>
                        <Button className="mt-8">Book First Appointment</Button>
                    </div>
                )}
            </div>
        </div>
    )
}
