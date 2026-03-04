"use client"

import { useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
    Plus,
    Search,
    MoreHorizontal,
    Edit,
    Trash2,
    User,
    Filter,
    CheckCircle2,
    XCircle
} from "lucide-react"

const doctors = [
    { id: "1", name: "Dr. Sarah Johnson", specialty: "Cardiology", status: "Active", availability: "Available", joined: "Jan 12, 2024" },
    { id: "2", name: "Dr. Michael Chen", specialty: "Neurology", status: "Active", availability: "On Leave", joined: "Feb 05, 2024" },
    { id: "3", name: "Dr. Emily Smith", specialty: "Dermatology", status: "Inactive", availability: "Available", joined: "Mar 20, 2024" },
    { id: "4", name: "Dr. David Williams", specialty: "Pediatrics", status: "Active", availability: "Available", joined: "May 15, 2024" },
    { id: "5", name: "Dr. Robert Wilson", specialty: "Psychiatry", status: "Active", availability: "Available", joined: "Jun 02, 2024" },
]

export default function AdminDoctorsPage() {
    const [searchTerm, setSearchTerm] = useState("")

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Doctor Management</h1>
                    <p className="text-muted-foreground mt-1">Add, edit, and manage clinic staff records.</p>
                </div>
                <Button className="shadow-lg shadow-blue-200 gap-2">
                    <Plus className="h-4 w-4" />
                    Add New Doctor
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name or specialty..."
                        className="pl-10 h-11 bg-card border-none shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline" className="h-11 px-6 gap-2 border-none bg-card shadow-sm">
                    <Filter className="h-4 w-4" />
                    Filters
                </Button>
            </div>

            <div className="bg-card/60 backdrop-blur-sm rounded-2xl border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-muted/50 bg-muted/30">
                            <TableHead className="pl-6 w-12">#</TableHead>
                            <TableHead>Doctor</TableHead>
                            <TableHead>Specialty</TableHead>
                            <TableHead>Joined Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Availability</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {doctors.map((doctor, idx) => (
                            <TableRow key={doctor.id} className="group hover:bg-accent/40 transition-colors border-muted/30">
                                <TableCell className="pl-6 text-muted-foreground font-mono text-xs">{idx + 1}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                                            <User className="h-5 w-5 text-primary" />
                                        </div>
                                        <span className="font-bold">{doctor.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="font-medium text-primary">{doctor.specialty}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{doctor.joined}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 font-semibold text-xs">
                                        {doctor.status === "Active" ? (
                                            <>
                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                                <span className="text-emerald-600">Active</span>
                                            </>
                                        ) : (
                                            <>
                                                <XCircle className="h-3.5 w-3.5 text-destructive" />
                                                <span className="text-destructive font-bold">Inactive</span>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={doctor.availability === "Available" ? "success" : "secondary"}>
                                        {doctor.availability}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                            <Trash2 className="h-4 w-4" />
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
