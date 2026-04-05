"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Home, Users, Calendar, MessageSquare, Menu, X, HeartPulse, LogOut } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

const navItems = [
    { name: "Home", href: "/", icon: Home },
    { name: "Doctors", href: "/doctors", icon: Users },
    { name: "Appointments", href: "/appointments", icon: Calendar },
    { name: "AI Chat", href: "/ai-chat", icon: MessageSquare },
]

export function PatientNavbar() {
    const pathname = usePathname()
    const router = useRouter()
    const { data: session } = useSession()
    const [isOpen, setIsOpen] = useState(false)
    const [showProfileMenu, setShowProfileMenu] = useState(false)

    const handleLogout = async () => {
        await signOut({ redirect: false })
        router.push("/auth/login")
        router.refresh()
    }

    return (
        <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    <div className="flex items-center">
                        <Link href="/" className="flex items-center space-x-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                <HeartPulse className="h-5 w-5" />
                            </div>
                            <span className="text-xl font-bold tracking-tight text-primary">ClinicAI</span>
                        </Link>
                    </div>

                    {/* Desktop Nav */}
                    <div className="hidden md:block">
                        <div className="flex items-center space-x-4">
                            {navItems.map((item) => {
                                const Icon = item.icon
                                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                            isActive
                                                ? "bg-primary/10 text-primary"
                                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        <span>{item.name}</span>
                                    </Link>
                                )
                            })}
                            <div className="ml-4 flex items-center space-x-2 border-l pl-4 relative">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="relative h-8 w-8 rounded-full bg-muted"
                                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                                >
                                    <img
                                        src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop"
                                        alt="Profile"
                                        className="rounded-full"
                                    />
                                </Button>
                                {showProfileMenu && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-card border rounded-lg shadow-lg z-50">
                                        <div className="p-3 border-b">
                                            <p className="text-sm font-semibold">{session?.user?.name}</p>
                                            <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
                                        </div>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            <span>Logout</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Mobile menu button */}
                    <div className="md:hidden flex items-center">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsOpen(!isOpen)}
                            className="inline-flex items-center justify-center p-2"
                        >
                            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile Nav */}
            {isOpen && (
                <div className="md:hidden border-t bg-background">
                    <div className="space-y-1 px-2 pb-3 pt-2">
                        {navItems.map((item) => {
                            const Icon = item.icon
                            const isActive = pathname === item.href
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className={cn(
                                        "flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium transition-colors",
                                        isActive
                                            ? "bg-primary/10 text-primary"
                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                    )}
                                >
                                    <Icon className="h-5 w-5" />
                                    <span>{item.name}</span>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            )}
        </nav>
    )
}
