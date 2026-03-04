import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    BarChart3,
    TrendingUp,
    Users,
    Calendar,
    Clock,
    Star,
    ChevronRight,
    Download,
    Activity
} from "lucide-react"

const topDoctors = [
    { name: "Dr. Sarah Johnson", specialty: "Cardiology", appointments: 124, rating: 4.9, trend: "+12%" },
    { name: "Dr. Emily Smith", specialty: "Dermatology", appointments: 98, rating: 5.0, trend: "+8%" },
    { name: "Dr. Michael Chen", specialty: "Neurology", appointments: 87, rating: 4.8, trend: "-3%" },
    { name: "Dr. David Williams", specialty: "Pediatrics", appointments: 76, rating: 4.7, trend: "+5%" },
]

export default function AdminReportsPage() {
    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
                    <p className="text-muted-foreground mt-1">Detailed insights into clinic performance and patient trends.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="h-11 px-6 border-none bg-card shadow-sm gap-2">
                        <Calendar className="h-4 w-4" />
                        Last 30 Days
                    </Button>
                    <Button className="h-11 px-6 shadow-lg shadow-blue-200 gap-2 font-bold">
                        <Download className="h-4 w-4" />
                        Export PDF
                    </Button>
                </div>
            </div>

            {/* Analytics Hero Section */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <Card className="lg:col-span-3 border-none bg-card shadow-sm overflow-hidden relative min-h-[400px]">
                    <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12">
                        <Activity className="h-64 w-64 text-primary" />
                    </div>
                    <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 px-8 py-6">
                        <div>
                            <CardTitle className="text-2xl">Appointment Success Rate</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">Comparison between scheduled and completed visits.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-primary" />
                                <span className="text-xs font-bold uppercase tracking-wider">Completed</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-muted" />
                                <span className="text-xs font-bold uppercase tracking-wider">Cancelled</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="flex items-end gap-3 h-64">
                            {[40, 65, 45, 90, 75, 85, 60, 95, 80, 70, 55, 80].map((h, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-4">
                                    <div
                                        className="w-full bg-primary/20 rounded-t-lg relative group transition-all"
                                        style={{ height: `${h}%` }}
                                    >
                                        <div className="absolute inset-0 bg-primary h-0 group-hover:h-full transition-all duration-500 rounded-t-lg" />
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 group-hover:opacity-100">{h}%</div>
                                    </div>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-10 p-6 bg-primary/5 rounded-2xl flex items-center justify-between border border-primary/10">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-blue-200">
                                    <TrendingUp className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold">Annual Growth: +24.8%</p>
                                    <p className="text-sm text-muted-foreground font-medium">Outpacing last fiscal year by $42k in revenue.</p>
                                </div>
                            </div>
                            <Button variant="link" className="text-primary font-bold">Analysis →</Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="border-none bg-card shadow-sm h-full">
                        <CardHeader>
                            <CardTitle className="text-lg">Key Metrics</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Patient Satisfaction</span>
                                    <span className="text-sm font-bold">4.8 / 5.0</span>
                                </div>
                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-400 rounded-full" style={{ width: "96%" }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">AI Efficiency</span>
                                    <span className="text-sm font-bold">92%</span>
                                </div>
                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 rounded-full" style={{ width: "92%" }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Peak Hour Load</span>
                                    <span className="text-sm font-bold">Max (10AM)</span>
                                </div>
                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: "75%" }} />
                                </div>
                            </div>

                            <div className="pt-6 border-t font-semibold">
                                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">Popular Specialty</p>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-2 w-2 rounded-full bg-primary" />
                                            <span className="text-sm">Cardiology</span>
                                        </div>
                                        <span className="text-xs font-bold">42%</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                            <span className="text-sm">Pediatrics</span>
                                        </div>
                                        <span className="text-xs font-bold">28%</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-2 w-2 rounded-full bg-amber-500" />
                                            <span className="text-sm">Dermatology</span>
                                        </div>
                                        <span className="text-xs font-bold">15%</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Top Performing Doctors */}
            <Card className="border-none bg-card shadow-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b px-8 py-6">
                    <CardTitle className="text-xl">Most Booked Doctors</CardTitle>
                    <Button variant="ghost" className="text-primary font-bold">Detailed View</Button>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-x divide-muted/50">
                        {topDoctors.map((doc, i) => (
                            <div key={i} className="p-8 hover:bg-muted/10 transition-colors group">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center border-2 border-background shadow-sm overflow-hidden group-hover:scale-110 transition-transform">
                                        <Users className="h-6 w-6 text-primary" />
                                    </div>
                                    <Badge variant="success" className="text-[10px]">{doc.trend}</Badge>
                                </div>
                                <h4 className="font-bold text-lg mb-1">{doc.name}</h4>
                                <p className="text-primary text-xs font-bold uppercase tracking-tight mb-4">{doc.specialty}</p>
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center text-muted-foreground font-medium">
                                        <Calendar className="h-3.5 w-3.5 mr-1" />
                                        {doc.appointments}
                                    </div>
                                    <div className="flex items-center font-bold">
                                        <Star className="h-3.5 w-3.5 mr-1 text-amber-500 fill-amber-500" />
                                        {doc.rating}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
