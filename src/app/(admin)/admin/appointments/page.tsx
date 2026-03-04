"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Calendar as CalendarIcon,
    Filter,
    MoreHorizontal,
    Check,
    X,
    Clock,
    User,
    Video,
    MapPin,
    Plus
} from "lucide-react"

const appointments = [
    { id: "1", patient: "Rabie Itwah", doctor: "Dr. Sarah Johnson", date: "Mar 12, 2026", time: "10:30 AM", status: "Upcoming", type: "Video" },
    { id: "2", patient: "Jane Smith", doctor: "Dr. Michael Chen", date: "Mar 12, 2026", time: "11:15 AM", status: "Pending", type: "Clinic" },
    { id: "3", patient: "John Doe", doctor: "Dr. Emily Smith", date: "Mar 12, 2026", time: "01:00 PM", status: "Completed", type: "Clinic" },
    { id: "4", patient: "Alice Brown", doctor: "Dr. Sarah Johnson", date: "Mar 12, 2026", time: "02:30 PM", status: "Cancelled", type: "Clinic" },
    { id: "5", patient: "Bob Wilson", doctor: "Dr. David Williams", date: "Mar 13, 2026", time: "09:00 AM", status: "Upcoming", type: "Video" },
]

export default function AdminAppointmentsPage() {
    const [activeView, setActiveView] = useState("table")

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Appointments Management</h1>
                    <p className="text-muted-foreground mt-1">Review, approve, and reschedule clinic appointments.</p>
                </div>
                <div className="flex bg-muted/50 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveView("table")}
                        className={cn(
                            "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                            activeView === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                        )}
                    >
                        Table View
                    </button>
                    <button
                        onClick={() => setActiveView("calendar")}
                        className={cn(
                            "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                            activeView === "calendar" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                        )}
                    >
                        Calendar
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Button variant="outline" className="h-14 border-none bg-card shadow-sm justify-start gap-3 px-4 group">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600 group-hover:bg-primary group-hover:text-white transition-colors">
                        <Filter className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Filter by</p>
                        <p className="text-sm font-bold">Doctor</p>
                    </div>
                </Button>
                <Button variant="outline" className="h-14 border-none bg-card shadow-sm justify-start gap-3 px-4 group">
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-600 group-hover:bg-primary group-hover:text-white transition-colors">
                        <CalendarIcon className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Filter by</p>
                        <p className="text-sm font-bold">Date</p>
                    </div>
                </Button>
                <Button variant="outline" className="h-14 border-none bg-card shadow-sm justify-start gap-3 px-4 group">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600 group-hover:bg-primary group-hover:text-white transition-colors">
                        <Clock className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Filter by</p>
                        <p className="text-sm font-bold">Status</p>
                    </div>
                </Button>
                <Button className="h-14 shadow-lg shadow-blue-100 gap-3 px-4">
                    <Plus className="h-5 w-5" />
                    <span className="font-bold">New Appointment</span>
                </Button>
            </div>

            <div className="bg-card/60 backdrop-blur-sm rounded-2xl border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-muted/50 bg-muted/30">
                            <TableHead className="pl-6">Patient</TableHead>
                            <TableHead>Doctor</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right pr-6">Quick Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {appointments.map((app) => (
                            <TableRow key={app.id} className="group hover:bg-accent/40 transition-colors border-muted/30">
                                <TableCell className="pl-6 font-bold">{app.patient}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <span className="text-sm font-semibold">{app.doctor}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-tighter">
                                        {app.type === "Video" ? (
                                            <div className="flex items-center gap-1.5 text-blue-600">
                                                <Video className="h-3.5 w-3.5" />
                                                <span>Tele-health</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-orange-600">
                                                <MapPin className="h-3.5 w-3.5" />
                                                <span>In-Clinic</span>
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm font-medium">
                                    <span className="text-foreground">{app.date}</span>
                                    <span className="text-muted-foreground ml-2">{app.time}</span>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={app.status === "Upcoming" ? "default" : app.status === "Pending" ? "secondary" : app.status === "Completed" ? "success" : "destructive"}>
                                        {app.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                    <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="outline" size="icon" className="h-8 w-8 text-emerald-600 border-emerald-100 hover:bg-emerald-50">
                                            <Check className="h-4 w-4" />
                                        </Button>
                                        <Button variant="outline" size="icon" className="h-8 w-8 text-destructive border-red-100 hover:bg-red-50">
                                            <X className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

