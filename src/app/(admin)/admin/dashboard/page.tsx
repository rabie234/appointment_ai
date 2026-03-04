import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Users,
    Calendar,
    UserPlus,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    MoreHorizontal
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

const stats = [
    {
        title: "Total Doctors",
        value: "128",
        change: "+4.5%",
        trend: "up",
        icon: Users,
        color: "text-blue-600",
        bg: "bg-blue-100 dark:bg-blue-900/20"
    },
    {
        title: "Total Appointments",
        value: "2,845",
        change: "+12.1%",
        trend: "up",
        icon: Calendar,
        color: "text-emerald-600",
        bg: "bg-emerald-100 dark:bg-emerald-900/20"
    },
    {
        title: "Today's Appointments",
        value: "42",
        change: "-2.3%",
        trend: "down",
        icon: Activity,
        color: "text-purple-600",
        bg: "bg-purple-100 dark:bg-purple-900/20"
    },
    {
        title: "Active Patients",
        value: "8,432",
        change: "+8.2%",
        trend: "up",
        icon: UserPlus,
        color: "text-orange-600",
        bg: "bg-orange-100 dark:bg-orange-900/20"
    },
]

const recentAppointments = [
    { id: "1", patient: "Rabie Itwah", doctor: "Dr. Sarah Johnson", date: "Mar 12, 10:30 AM", status: "Confirmed", type: "Video" },
    { id: "2", patient: "Jane Smith", doctor: "Dr. Michael Chen", date: "Mar 12, 11:15 AM", status: "Pending", type: "In-Person" },
    { id: "3", patient: "John Doe", doctor: "Dr. Emily Smith", date: "Mar 12, 01:00 PM", status: "Completed", type: "In-Person" },
    { id: "4", patient: "Alice Brown", doctor: "Dr. Sarah Johnson", date: "Mar 12, 02:30 PM", status: "Confirmed", type: "In-Person" },
    { id: "5", patient: "Bob Wilson", doctor: "Dr. David Williams", date: "Mar 13, 09:00 AM", status: "Confirmed", type: "Video" },
]

export default function AdminDashboardPage() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
                    <p className="text-muted-foreground mt-1">Welcome back, Admin. Here's what's happening today.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="hidden sm:flex">Download Report</Button>
                    <Button className="shadow-lg shadow-blue-200">Generate Insights</Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <Card key={stat.title} className="border-none shadow-sm bg-card/60 backdrop-blur-sm group hover:shadow-md transition-all">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                            <div className={`${stat.bg} ${stat.color} p-2 rounded-xl transition-transform group-hover:scale-110`}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <div className="flex items-center mt-1">
                                {stat.trend === "up" ? (
                                    <ArrowUpRight className="h-4 w-4 text-emerald-500 mr-1" />
                                ) : (
                                    <ArrowDownRight className="h-4 w-4 text-destructive mr-1" />
                                )}
                                <span className={stat.trend === "up" ? "text-emerald-500 font-medium text-xs" : "text-destructive font-medium text-xs"}>
                                    {stat.change}
                                </span>
                                <span className="text-[10px] text-muted-foreground ml-1">from last month</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Appointments Table */}
                <Card className="lg:col-span-2 border-none shadow-sm bg-card/60">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-xl">Recent Appointments</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">A list of appointments scheduled for the next 48 hours.</p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-primary font-bold">View All</Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-muted/50">
                                    <TableHead className="pl-6">Patient</TableHead>
                                    <TableHead>Doctor</TableHead>
                                    <TableHead>Date & Time</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right pr-6">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentAppointments.map((app) => (
                                    <TableRow key={app.id} className="group hover:bg-accent/50 transition-colors border-muted/30">
                                        <TableCell className="pl-6 font-medium">{app.patient}</TableCell>
                                        <TableCell className="text-muted-foreground font-medium">{app.doctor}</TableCell>
                                        <TableCell className="text-xs font-semibold">{app.date}</TableCell>
                                        <TableCell>
                                            <Badge variant={app.status === "Confirmed" ? "default" : app.status === "Pending" ? "secondary" : "success"}>
                                                {app.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Mini Chart / Analytics Card */}
                <Card className="border-none shadow-sm bg-card/60 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Activity className="h-32 w-32 text-primary" />
                    </div>
                    <CardHeader>
                        <CardTitle className="text-xl">Appointment Trends</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">Stats for the current week.</p>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6 mt-4">
                            {[
                                { day: "Mon", val: 85, color: "bg-blue-500" },
                                { day: "Tue", val: 65, color: "bg-blue-400" },
                                { day: "Wed", val: 92, color: "bg-blue-600" },
                                { day: "Thu", val: 45, color: "bg-blue-300" },
                                { day: "Fri", val: 78, color: "bg-blue-500" },
                            ].map(item => (
                                <div key={item.day} className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                                        <span>{item.day}</span>
                                        <span className="text-muted-foreground">{item.val}% Capacity</span>
                                    </div>
                                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.val}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button className="w-full mt-10 variant-outline border-primary/20 text-primary hover:bg-primary/5">
                            View Full Reports
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
