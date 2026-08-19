"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Star, Clock, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

export type DoctorCard = {
    id: string
    name: string
    specialty: string
    rating: number
    reviews: number
    available: boolean
    image: string
}

const ALL = "All Specialties"

export function DoctorsListing({
    doctors,
    specialties,
}: {
    doctors: DoctorCard[]
    specialties: string[]
}) {
    const [selectedSpecialty, setSelectedSpecialty] = useState(ALL)
    const [availableOnly, setAvailableOnly] = useState(false)
    const [search, setSearch] = useState("")

    const term = search.trim().toLowerCase()
    const filtered = doctors.filter((d) => {
        if (selectedSpecialty !== ALL && d.specialty !== selectedSpecialty) return false
        if (availableOnly && !d.available) return false
        if (term && !d.name.toLowerCase().includes(term)) return false
        return true
    })

    const specialtyOptions = [ALL, ...specialties]

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
                        <Input
                            placeholder="Search name..."
                            className="pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Filter Sidebar */}
                <aside className="w-full lg:w-64 space-y-6">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Specialty</h3>
                        <div className="space-y-1">
                            {specialtyOptions.map((s) => (
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
                            <input
                                type="checkbox"
                                id="available-today"
                                checked={availableOnly}
                                onChange={(e) => setAvailableOnly(e.target.checked)}
                                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                            />
                            <label htmlFor="available-today" className="text-sm font-medium leading-none">
                                Available only
                            </label>
                        </div>
                    </div>
                </aside>

                {/* Doctors Grid */}
                <div className="flex-1">
                    {filtered.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground">
                            No doctors match your filters.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {filtered.map((doctor) => (
                                <Card key={doctor.id} className="group hover:shadow-lg transition-all duration-300 border-none bg-card/60 overflow-hidden">
                                    <div className="flex flex-col sm:flex-row h-full">
                                        <div className="relative w-full sm:w-40 aspect-square sm:aspect-auto bg-muted flex items-center justify-center">
                                            {doctor.image ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={doctor.image}
                                                    alt={doctor.name}
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                />
                                            ) : (
                                                <span className="text-4xl font-bold text-primary/40">
                                                    {doctor.name.replace(/^Dr\.?\s*/i, "").charAt(0)}
                                                </span>
                                            )}
                                            {doctor.available && (
                                                <Badge variant="success" className="absolute top-2 left-2 shadow-sm">
                                                    Available
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex-1 p-5 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start">
                                                    <CardTitle className="text-lg group-hover:text-primary transition-colors">{doctor.name}</CardTitle>
                                                    <div className="flex items-center text-amber-500 text-sm font-bold bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                                                        <Star className="h-3 w-3 fill-current mr-1" />
                                                        {doctor.rating.toFixed(1)}
                                                    </div>
                                                </div>
                                                <p className="text-primary text-sm font-semibold mt-1">{doctor.specialty}</p>

                                                <div className="mt-4 space-y-2">
                                                    <div className="flex items-center text-xs text-muted-foreground">
                                                        <Clock className="h-3.5 w-3.5 mr-2 text-primary" />
                                                        <span>{doctor.reviews} reviews</span>
                                                    </div>
                                                    <div className="flex items-center text-xs text-muted-foreground">
                                                        <MapPin className="h-3.5 w-3.5 mr-2 text-primary" />
                                                        <span>Downtown Medical Center</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-6">
                                                <Link href={`/doctors/${doctor.id}`}>
                                                    <Button className="w-full shadow-md shadow-blue-100" size="sm">
                                                        View Profile
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
