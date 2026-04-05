"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import {
    LayoutDashboard,
    Users,
    Calendar,
    UserRound,
    Settings,
    BarChart3,
    BrainCircuit,
    HeartPulse,
    LogOut
} from "lucide-react"
import { cn } from "@/lib/utils"

const adminNavItems = [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Doctors", href: "/admin/doctors", icon: Users },
    { name: "Appointments", href: "/admin/appointments", icon: Calendar },
    { name: "Patients", href: "/admin/patients", icon: UserRound },
    { name: "AI Training", href: "/admin/ai-training", icon: BrainCircuit },
    { name: "Reports", href: "/admin/reports", icon: BarChart3 },
    { name: "Settings", href: "/admin/settings", icon: Settings },
]

export function AdminSidebar() {
    const pathname = usePathname()
    const router = useRouter()

    const handleLogout = async () => {
        await signOut({ redirect: false })
        router.push("/auth/login")
        router.refresh()
    }

    return (
        <aside className="hidden lg:flex flex-col w-64 border-r bg-card h-screen sticky top-0 overflow-hidden">
            <div className="p-6 border-b flex items-center space-x-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-blue-200">
                    <HeartPulse className="h-6 w-6" />
                </div>
                <div>
                    <span className="text-xl font-bold tracking-tight text-primary">ClinicAI</span>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Admin Panel</p>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {adminNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                                isActive
                                    ? "bg-primary text-primary-foreground shadow-md shadow-blue-100"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                        >
                            <Icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : "text-primary group-hover:scale-110 transition-transform")} />
                            <span>{item.name}</span>
                        </Link>
                    )
                })}
            </nav>

            <div className="p-4 border-t">
                <button 
                    onClick={handleLogout}
                    className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors group"
                >
                    <LogOut className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    )
}
