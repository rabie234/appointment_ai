"use client"
import { useFormStatus } from "react-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { WeekEditor } from "@/components/schedule/week-editor"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"
import { DAYS, type DayHours } from "@/lib/schedule"
import {
    updateMyProfile,
    updateMyAvailability,
    updateMySchedule,
    changeMyPassword,
    type AccountFormState,
} from "./actions"
import {
    requestMyLeave,
    type LeaveRequestState,
} from "./leave-actions"
import { useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import { cancelMyLeaveRequest } from "./leave-actions"

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
export type DoctorLeaveRequest = {
    id: string
    startDate: string
    endDate: string
    reason: string
    status: "pending" | "approved" | "rejected" | "cancelled"
    adminNote: string
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

function Feedback({ state, language }: { state: AccountFormState; language: "ar" | "en" }) {
    if (state.error) {
        return <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{t(language, state.error)}</p>
    }
    if (state.success) {
        return <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">{t(language, state.success)}</p>
    }
    return null
}

function clinicHoursSummary(hours: DayHours[], language: "ar" | "en"): string {
    return DAYS.map((day) => {
        const h = hours.find((c) => c.day === day)
        const dayName = t(language, day)

        return !h || h.closed
            ? `${dayName}: ${t(language, "Closed")}`
            : `${dayName}: ${h.open}–${h.close}`
    }).join(" · ")
}

export function AccountForms({
    account,
    clinicHours,
    leaveRequests,
}: {
    account: DoctorAccount
    clinicHours: DayHours[]
    leaveRequests: DoctorLeaveRequest[]
}) {
    const [profile, profileAction] = useActionState<AccountFormState, FormData>(updateMyProfile, {})
    const [availability, availabilityAction] = useActionState<AccountFormState, FormData>(updateMyAvailability, {})
    const [schedule, scheduleAction] = useActionState<AccountFormState, FormData>(updateMySchedule, {})
    const [password, passwordAction] = useActionState<AccountFormState, FormData>(changeMyPassword, {})
    const router = useRouter()
const [cancellingLeaveId, setCancellingLeaveId] =
    useState<string | null>(null)
    const { language } = useLanguage()
    const onLeave = account.availability === "on-leave"
    const [leaveRequest, leaveRequestAction] =
    useActionState<LeaveRequestState, FormData>(requestMyLeave, {})
    async function handleCancelLeaveRequest(leaveId: string) {
    if (!window.confirm(t(language, "Cancel this pending leave request?"))) {
        return
    }

    setCancellingLeaveId(leaveId)

    try {
        const result = await cancelMyLeaveRequest(leaveId)

        if (result.error) {
            window.alert(t(language, result.error))
            return
        }

        router.refresh()
    } catch {
        window.alert(
            t(language, "Could not cancel your leave request. Please try again."),
        )
    } finally {
        setCancellingLeaveId(null)
    }
}
    return (
        <div className="space-y-8 animate-in fade-in duration-500" dir={language === "ar" ? "rtl" : "ltr"}>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t(language, "My Account")}</h1>
                <p className="text-muted-foreground mt-1">{t(language, "Manage your profile, working hours and password.")}</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Profile */}
                <Card className="border-none shadow-sm bg-card/60">
                    <CardHeader className="flex flex-row items-start justify-between">
                        <div>
                            <CardTitle className="text-xl">{t(language, "Profile")}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">{t(language, account.specialty)}</p>
                        </div>
                        <Badge variant={account.status === "active" ? "success" : "destructive"}>
                            {account.status === "active" ? t(language, "Active") : t(language, "Inactive")}
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        <form action={profileAction} className="space-y-4">
                            <Field label={t(language, "Full Name")}>
                                <Input name="name" defaultValue={account.name} required />
                            </Field>
                            <Field label={t(language, "Name in Arabic")}>
                                <Input name="nameAr" defaultValue={account.nameAr} dir="rtl" />
                            </Field>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label={t(language, "Phone")}>
                                    <Input name="phone" defaultValue={account.phone} placeholder="+1 555 000 0000" />
                                </Field>
                                <Field label={t(language, "Experience")}>
                                    <Input name="experience" defaultValue={account.experience} placeholder={t(language, "e.g. 8 Years")} />
                                </Field>
                            </div>
                            <Field label={t(language, "Email (your login)")} hint={t(language, "Email, specialty and active status are managed by the clinic administrator.")}>
                                <Input value={account.email} disabled readOnly />
                            </Field>
                            <Feedback state={profile} language={language} />
                            <div className="flex justify-end"><SubmitButton>{t(language, "Save Profile")}</SubmitButton></div>
                        </form>
                    </CardContent>
                </Card>

                <div className="space-y-8">
                    {/* Availability */}
                    <Card className="border-none shadow-sm bg-card/60">
                        <CardHeader className="flex flex-row items-start justify-between">
                            <div>
                                <CardTitle className="text-xl">{t(language, "Availability")}</CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {t(language, onLeave ? "Patients currently see you as on leave." : "Patients currently see you as available.")}
                                </p>
                            </div>
                            <Badge variant={onLeave ? "secondary" : "success"}>{t(language, onLeave ? "On Leave" : "Available")}</Badge>
                        </CardHeader>
                        <CardContent>
                            <form action={availabilityAction} className="space-y-4">
                                <input type="hidden" name="availability" value={onLeave ? "available" : "on-leave"} />
                                <Feedback state={availability} language={language} />
                                <SubmitButton>{t(language, onLeave ? "I'm back — mark me available" : "Mark me on leave")}</SubmitButton>
                            </form>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-card/60">
    <CardHeader>
        <CardTitle className="text-xl">
            {t(language, "My Leave Requests")}
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
            {t(language, "Leave requests need administrator approval.")}
        </p>
    </CardHeader>

    <CardContent className="space-y-6">
        <form action={leaveRequestAction} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t(language, "Start Date")}>
                    <Input name="startDate" type="date" required />
                </Field>
                <Field label={t(language, "End Date")}>
                    <Input name="endDate" type="date" required />
                </Field>
            </div>

            <Field label={t(language, "Reason")} hint={t(language, "Optional")}>
                <Input name="reason" maxLength={500} />
            </Field>

            <Feedback state={leaveRequest} language={language} />

            <div className="flex justify-end">
                <SubmitButton>
                    {t(language, "Submit Leave Request")}
                </SubmitButton>
            </div>
        </form>

        <div className="space-y-3 border-t pt-5">
            <h3 className="font-semibold">
                {t(language, "Request History")}
            </h3>

            {leaveRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t(language, "You have no leave requests.")}
                </p>
            ) : (
                leaveRequests.map((leave) => (
                    <div
                        key={leave.id}
                        className="rounded-lg border p-4 space-y-2"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">
                                {leave.startDate} – {leave.endDate}
                            </p>
                            <Badge variant="secondary">
                                {t(language, leave.status)}
                            </Badge>
                        </div>
                {leave.status === "pending" && (
    <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={cancellingLeaveId === leave.id}
        onClick={() => handleCancelLeaveRequest(leave.id)}
    >
        {cancellingLeaveId === leave.id
            ? t(language, "Cancelling...")
            : t(language, "Cancel request")}
    </Button>
)}
                        {leave.reason && (
                            <p className="text-sm text-muted-foreground">
                                {t(language, "Reason")}: {leave.reason}
                            </p>
                        )}

                        {leave.adminNote && (
                            <p className="text-sm">
                                {t(language, "Administrator note")}: {leave.adminNote}
                            </p>
                        )}
                    </div>
                ))
            )}
        </div>
    </CardContent>
</Card>

                    {/* Password */}
                    <Card className="border-none shadow-sm bg-card/60">
                        <CardHeader>
                            <CardTitle className="text-xl">{t(language, "Password")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form action={passwordAction} className="space-y-4">
                                <Field label={t(language, "Current Password")}>
                                    <Input name="currentPassword" type="password" autoComplete="current-password" required />
                                </Field>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label={t(language, "New Password")}>
                                        <Input name="newPassword" type="password" autoComplete="new-password" minLength={6} required />
                                    </Field>
                                    <Field label={t(language, "Confirm New Password")}>
                                        <Input name="confirmPassword" type="password" autoComplete="new-password" minLength={6} required />
                                    </Field>
                                </div>
                                <Feedback state={password} language={language} />
                                <div className="flex justify-end"><SubmitButton>{t(language, "Change Password")}</SubmitButton></div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Working hours */}
            <Card className="border-none shadow-sm bg-card/60">
                <CardHeader>
                    <CardTitle className="text-xl">{t(language, "Working Hours")}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        {t(language, "Patients can only book inside these hours. They must fall within the clinic&apos;s opening times.")}
                    </p>
                    <p className="text-xs font-medium text-foreground/70 mt-1">{t(language, "Clinic:")} {clinicHoursSummary(clinicHours, language)}</p>
                </CardHeader>
                <CardContent>
                    <form action={scheduleAction} className="space-y-4 max-w-2xl">
                        <WeekEditor prefix="doctor" initial={account.schedule} closedLabel={t(language, "Off")} />
                        <Feedback state={schedule} language={language} />
                        <div className="flex justify-end"><SubmitButton>{t(language, "Save Working Hours")}</SubmitButton></div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}


