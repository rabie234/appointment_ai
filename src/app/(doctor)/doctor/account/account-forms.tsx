"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"
import {
    updateMyProfile,
    requestMyScheduleChange,
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
}

function SubmitButton({ children }: { children: React.ReactNode }) {
    const { pending } = useFormStatus()

    return (
        <Button
            type="submit"
            disabled={pending}
            className="gap-2 shadow-lg shadow-blue-200"
        >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {children}
        </Button>
    )
}

function Field({
    label,
    hint,
    children,
}: {
    label: string
    hint?: string
    children: React.ReactNode
}) {
    return (
        <label className="block space-y-1.5">
            <span className="text-sm font-medium">{label}</span>
            {children}
            {hint && (
                <span className="block text-xs text-muted-foreground">
                    {hint}
                </span>
            )}
        </label>
    )
}

function Feedback({
    state,
    language,
}: {
    state: AccountFormState
    language: "ar" | "en"
}) {
    if (state.error) {
        return (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {t(language, state.error)}
            </p>
        )
    }

    if (state.success) {
        return (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                {t(language, state.success)}
            </p>
        )
    }

    return null
}

export function AccountForms({
    account,
}: {
    account: DoctorAccount
  
}) {
    const [profile, profileAction] =
        useActionState<AccountFormState, FormData>(updateMyProfile, {})
    const [schedule, scheduleAction] =
    useActionState<AccountFormState, FormData>(
        requestMyScheduleChange,
        {}
    )
    const [password, passwordAction] =
        useActionState<AccountFormState, FormData>(changeMyPassword, {})

    const { language } = useLanguage()

    return (
        <div
            className="space-y-8 animate-in fade-in duration-500"
            dir={language === "ar" ? "rtl" : "ltr"}
        >
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    {t(language, "My Account")}
                </h1>
                <p className="mt-1 text-muted-foreground">
                    {t(
                        language,
                        "Manage your profile, working hours and password."
                    )}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                <Card className="border-none bg-card/60 shadow-sm">
                    <CardHeader className="flex flex-row items-start justify-between">
                        <div>
                            <CardTitle className="text-xl">
                                {t(language, "Profile")}
                            </CardTitle>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {t(language, account.specialty)}
                            </p>
                        </div>
                        <Badge
                            variant={
                                account.status === "active"
                                    ? "success"
                                    : "destructive"
                            }
                        >
                            {account.status === "active"
                                ? t(language, "Active")
                                : t(language, "Inactive")}
                        </Badge>
                    </CardHeader>

                    <CardContent>
                        <form action={profileAction} className="space-y-4">
                            <Field label={t(language, "Full Name")}>
                                <Input
                                    name="name"
                                    defaultValue={account.name}
                                    required
                                />
                            </Field>

                            <Field label={t(language, "Name in Arabic")}>
                                <Input
                                    name="nameAr"
                                    defaultValue={account.nameAr}
                                    dir="rtl"
                                />
                            </Field>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Field label={t(language, "Phone")}>
                                    <Input
                                        name="phone"
                                        defaultValue={account.phone}
                                        placeholder="+1 555 000 0000"
                                    />
                                </Field>

                                <Field label={t(language, "Experience")}>
                                    <Input
                                        name="experience"
                                        defaultValue={account.experience}
                                        placeholder={t(language, "e.g. 8 Years")}
                                    />
                                </Field>
                            </div>

                            <Field
                                label={t(language, "Email (your login)")}
                                hint={t(
                                    language,
                                    "Email, specialty and active status are managed by the clinic administrator."
                                )}
                            >
                                <Input
                                    value={account.email}
                                    disabled
                                    readOnly
                                />
                            </Field>

                            <Feedback state={profile} language={language} />

                            <div className="flex justify-end">
                                <SubmitButton>
                                    {t(language, "Save Profile")}
                                </SubmitButton>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <div className="space-y-8">
                    <Card className="border-none bg-card/60 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl">
                                {t(language, "Password")}
                            </CardTitle>
                        </CardHeader>

                        <CardContent>
                            <form action={passwordAction} className="space-y-4">
                                <Field
                                    label={t(language, "Current Password")}
                                >
                                    <Input
                                        name="currentPassword"
                                        type="password"
                                        autoComplete="current-password"
                                        required
                                    />
                                </Field>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field label={t(language, "New Password")}>
                                        <Input
                                            name="newPassword"
                                            type="password"
                                            autoComplete="new-password"
                                            minLength={6}
                                            required
                                        />
                                    </Field>

                                    <Field
                                        label={t(
                                            language,
                                            "Confirm New Password"
                                        )}
                                    >
                                        <Input
                                            name="confirmPassword"
                                            type="password"
                                            autoComplete="new-password"
                                            minLength={6}
                                            required
                                        />
                                    </Field>
                                </div>

                                <Feedback state={password} language={language} />

                                <div className="flex justify-end">
                                    <SubmitButton>
                                        {t(language, "Change Password")}
                                    </SubmitButton>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Card className="border-none bg-card/60 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-xl">
                        {t(language, "Working Hours")}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t(
                            language,
                            "Patients can only book inside these hours. They must fall within the clinic&apos;s opening times."
                        )}
                    </p>
            
                </CardHeader>

                <CardContent>
                    <form
                        action={scheduleAction}
                        className="max-w-2xl space-y-4"
                    >
                       

                        <Feedback state={schedule} language={language} />
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}