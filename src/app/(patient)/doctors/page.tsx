"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Search,
    Filter,
    Star,
    Clock,
    MapPin,
    ChevronRight,
    User
} from "lucide-react"
import { cn } from "@/lib/utils"

const specialties = [
    "All Specialties",
    "Cardiology",
    "Dermatology",
    "Neurology",
    "Pediatrics",
    "Psychiatry",
    "Radiology",
]

const doctors = [
    {
        id: 1,
        name: "Dr. Sarah Johnson",
        specialty: "Cardiology",
        rating: 4.9,
        reviews: 124,
        available: true,
        image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=200&auto=format&fit=crop",
    },
    {
        id: 2,
        name: "Dr. Michael Chen",
        specialty: "Neurology",
        rating: 4.8,
        reviews: 89,
        available: true,
        image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=200&auto=format&fit=crop",
    },
    {
        id: 3,
        name: "Dr. Emily Smith",
        specialty: "Dermatology",
        rating: 5.0,
        reviews: 215,
        available: false,
        image: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?q=80&w=200&auto=format&fit=crop",
    },
    {
        id: 4,
        name: "Dr. David Williams",
        specialty: "Pediatrics",
        rating: 4.7,
        reviews: 67,
        available: true,
        image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=200&auto=format&fit=crop",
    },
]

export default function DoctorsListingPage() {
    const [selectedSpecialty, setSelectedSpecialty] = useState("All Specialties")

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Find a Doctor</h1>
                    <p className="text-muted-foreground mt-1">Book an appointment with our world-class specialists.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search name..." className="pl-10" />
                    </div>
                    <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Filter Sidebar */}
                <aside className="w-full lg:w-64 space-y-6">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Specialty</h3>
                        <div className="space-y-1">
                            {specialties.map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setSelectedSpecialty(s)}
                                    className={cn(
                                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                                        selectedSpecialty === s
                                            ? "bg-primary text-primary-foreground font-medium"
                                            : "hover:bg-accent hover:text-accent-foreground"
                                    )}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Availability</h3>
                        <div className="flex items-center space-x-2">
                            <input type="checkbox" id="available-today" className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4" />
                            <label htmlFor="available-today" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Available Today
                            </label>
                        </div>
                    </div>
                </aside>

                {/* Doctors Grid */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
                    {doctors.map((doctor) => (
                        <Card key={doctor.id} className="group hover:shadow-lg transition-all duration-300 border-none bg-card/60 overflow-hidden">
                            <div className="flex flex-col sm:flex-row h-full">
                                <div className="relative w-full sm:w-40 aspect-square sm:aspect-auto">
                                    <img
                                        src={doctor.image}
                                        alt={doctor.name}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    {doctor.available && (
                                        <Badge variant="success" className="absolute top-2 left-2 shadow-sm">
                                            Available Today
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex-1 p-5 flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-lg group-hover:text-primary transition-colors">{doctor.name}</CardTitle>
                                            <div className="flex items-center text-amber-500 text-sm font-bold bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                                                <Star className="h-3 w-3 fill-current mr-1" />
                                                {doctor.rating}
                                            </div>
                                        </div>
                                        <p className="text-primary text-sm font-semibold mt-1">{doctor.specialty}</p>

                                        <div className="mt-4 space-y-2">
                                            <div className="flex items-center text-xs text-muted-foreground">
                                                <Clock className="h-3.5 w-3.5 mr-2 text-primary" />
                                                <span>Wait time: &lt; 15 mins</span>
                                            </div>
                                            <div className="flex items-center text-xs text-muted-foreground">
                                                <MapPin className="h-3.5 w-3.5 mr-2 text-primary" />
                                                <span>Downtown Medical Center</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex items-center gap-3">
                                        <Link href={`/doctors/${doctor.id}`} className="flex-1">
                                            <Button className="w-full shadow-md shadow-blue-100" size="sm">
                                                View Profile
                                            </Button>
                                        </Link>
                                        <Button variant="outline" size="icon" className="h-9 w-9">
                                            <HeartPulse className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    )
}

function HeartPulse({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
        </svg>
    )
}
