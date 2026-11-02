"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { WeekEditor } from "@/components/schedule/week-editor"
import { DAYS, type DayHours } from "@/lib/schedule"
import {
    updateMyProfile,
    updateMyAvailability,
    updateMySchedule,
    changeMyPassword,
    type AccountFormState,
} from "./actions"

export type DoctorAccount = {
    name: string
    nameAr: string
    email: string
    phone: string
    experience: string
    specialty: string
    status: "active" | "inactive"
    availability: "available" | "on-leave"
    schedule: DayHours[]
}

function SubmitButton({ children }: { children: React.ReactNode }) {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending} className="gap-2 shadow-lg shadow-blue-200">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {children}
        </Button>
    )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="block space-y-1.5">
            <span className="text-sm font-medium">{label}</span>
            {children}
            {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
        </label>
    )
}

function Feedback({ state }: { state: AccountFormState }) {
    if (state.error) {
        return <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{state.error}</p>
    }
    if (state.success) {
        return <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">{state.success}</p>
    }
    return null
}

function clinicHoursSummary(hours: DayHours[]): string {
    return DAYS.map((day) => {
        const h = hours.find((c) => c.day === day)
        return !h || h.closed ? `${day.slice(0, 3)} closed` : `${day.slice(0, 3)} ${h.open}–${h.close}`
    }).join(" · ")
}

export function AccountForms({ account, clinicHours }: { account: DoctorAccount; clinicHours: DayHours[] }) {
    const [profile, profileAction] = useActionState<AccountFormState, FormData>(updateMyProfile, {})
    const [availability, availabilityAction] = useActionState<AccountFormState, FormData>(updateMyAvailability, {})
    const [schedule, scheduleAction] = useActionState<AccountFormState, FormData>(updateMySchedule, {})
    const [password, passwordAction] = useActionState<AccountFormState, FormData>(changeMyPassword, {})

    const onLeave = account.availability === "on-leave"

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">My Account</h1>
                <p className="text-muted-foreground mt-1">Manage your profile, working hours and password.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Profile */}
                <Card className="border-none shadow-sm bg-card/60">
                    <CardHeader className="flex flex-row items-start justify-between">
                        <div>
                            <CardTitle className="text-xl">Profile</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">{account.specialty}</p>
                        </div>
                        <Badge variant={account.status === "active" ? "success" : "destructive"}>
                            {account.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        <form action={profileAction} className="space-y-4">
                            <Field label="Full Name">
                                <Input name="name" defaultValue={account.name} required />
                            </Field>
                            <Field label="Name in Arabic">
                                <Input name="nameAr" defaultValue={account.nameAr} dir="rtl" />
                            </Field>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Phone">
                                    <Input name="phone" defaultValue={account.phone} placeholder="+1 555 000 0000" />
                                </Field>
                                <Field label="Experience">
                                    <Input name="experience" defaultValue={account.experience} placeholder="e.g. 8 Years" />
                                </Field>
                            </div>
                            <Field label="Email (your login)" hint="Email, specialty and active status are managed by the clinic administrator.">
                                <Input value={account.email} disabled readOnly />
                            </Field>
                            <Feedback state={profile} />
                            <div className="flex justify-end"><SubmitButton>Save Profile</SubmitButton></div>
                        </form>
                    </CardContent>
                </Card>

                <div className="space-y-8">
                    {/* Availability */}
                    <Card className="border-none shadow-sm bg-card/60">
                        <CardHeader className="flex flex-row items-start justify-between">
                            <div>
                                <CardTitle className="text-xl">Availability</CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {onLeave ? "Patients currently see you as on leave." : "Patients currently see you as available."}
                                </p>
                            </div>
                            <Badge variant={onLeave ? "secondary" : "success"}>{onLeave ? "On Leave" : "Available"}</Badge>
                        </CardHeader>
                        <CardContent>
                            <form action={availabilityAction} className="space-y-4">
                                <input type="hidden" name="availability" value={onLeave ? "available" : "on-leave"} />
                                <Feedback state={availability} />
                                <SubmitButton>{onLeave ? "I'm back — mark me available" : "Mark me on leave"}</SubmitButton>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Password */}
                    <Card className="border-none shadow-sm bg-card/60">
                        <CardHeader>
                            <CardTitle className="text-xl">Password</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form action={passwordAction} className="space-y-4">
                                <Field label="Current Password">
                                    <Input name="currentPassword" type="password" autoComplete="current-password" required />
                                </Field>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="New Password">
                                        <Input name="newPassword" type="password" autoComplete="new-password" minLength={6} required />
                                    </Field>
                                    <Field label="Confirm New Password">
                                        <Input name="confirmPassword" type="password" autoComplete="new-password" minLength={6} required />
                                    </Field>
                                </div>
                                <Feedback state={password} />
                                <div className="flex justify-end"><SubmitButton>Change Password</SubmitButton></div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Working hours */}
            <Card className="border-none shadow-sm bg-card/60">
                <CardHeader>
                    <CardTitle className="text-xl">Working Hours</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Patients can only book inside these hours. They must fall within the clinic&apos;s opening times.
                    </p>
                    <p className="text-xs font-medium text-foreground/70 mt-1">Clinic: {clinicHoursSummary(clinicHours)}</p>
                </CardHeader>
                <CardContent>
                    <form action={scheduleAction} className="space-y-4 max-w-2xl">
                        <WeekEditor prefix="doctor" initial={account.schedule} closedLabel="Off" />
                        <Feedback state={schedule} />
                        <div className="flex justify-end"><SubmitButton>Save Working Hours</SubmitButton></div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
