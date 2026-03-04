import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Search,
    PlusCircle,
    MessageSquare,
    Users,
    Calendar,
    ArrowRight,
    Clock,
    User
} from "lucide-react"

export default function PatientDashboard() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Greeting & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back, Rabie</h1>
                    <p className="text-muted-foreground mt-1">Your health is our priority. How can we help you today?</p>
                </div>
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Ask AI about doctors or appointments..."
                        className="pl-10 bg-card border-none shadow-sm focus-visible:ring-primary"
                    />
                </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { title: "Book Appointment", icon: PlusCircle, color: "bg-blue-500", href: "/doctors" },
                    { title: "Chat with AI", icon: MessageSquare, color: "bg-purple-500", href: "/ai-chat" },
                    { title: "View Doctors", icon: Users, color: "bg-emerald-500", href: "/doctors" },
                    { title: "My Appointments", icon: Calendar, color: "bg-orange-500", href: "/appointments" },
                ].map((action) => (
                    <Card key={action.title} className="group hover:shadow-md transition-all cursor-pointer border-none bg-card/60 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className={`${action.color} p-2 rounded-lg text-white`}>
                                <action.icon className="h-5 w-5" />
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm font-medium">{action.title}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Upcoming Appointment */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Upcoming Appointment</h2>
                        <Button variant="link" className="text-primary p-0">View all</Button>
                    </div>
                    <Card className="border-none shadow-sm overflow-hidden bg-gradient-to-br from-primary/5 to-transparent">
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-start space-x-4">
                                    <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                                        <User className="h-7 w-7 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg">Dr. Sarah Johnson</h3>
                                        <p className="text-primary text-sm font-medium">Cardiologist</p>
                                        <div className="flex items-center mt-2 text-sm text-muted-foreground space-x-4">
                                            <span className="flex items-center"><Calendar className="mr-1.5 h-4 w-4 text-primary" /> March 12, 2026</span>
                                            <span className="flex items-center"><Clock className="mr-1.5 h-4 w-4 text-primary" /> 10:30 AM</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-col gap-2">
                                    <Button variant="outline" size="sm">Reschedule</Button>
                                    <Button size="sm">Join Video Call</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* AI Chat Preview */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">AI Assistant</h2>
                    <Card className="border-none shadow-sm h-[200px] flex flex-col bg-card/60">
                        <CardHeader className="p-4 pb-2 border-b bg-muted/30">
                            <CardTitle className="text-sm font-medium flex items-center">
                                <MessageSquare className="mr-2 h-4 w-4 text-primary" />
                                Recent AI Chat
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 flex-1 flex flex-col justify-between">
                            <p className="text-sm text-muted-foreground italic">
                                "I've found 3 cardiologists available this Thursday. Would you like to see their profiles?"
                            </p>
                            <Button variant="secondary" size="sm" className="w-full mt-4">
                                Continue Chat
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
