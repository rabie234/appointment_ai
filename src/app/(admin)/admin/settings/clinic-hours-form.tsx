
"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { WeekEditor } from "@/components/schedule/week-editor"
import { Clock, Loader2, CheckCircle2 } from "lucide-react"
import { type DayHours } from "@/lib/schedule"
import { updateClinicHours, type ClinicHoursState } from "./actions"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"

function SaveButton() {
    const { pending } = useFormStatus()
    const { language } = useLanguage()

    return (
        <Button
            type="submit"
            disabled={pending}
            className="gap-2 shadow-lg shadow-blue-200"
        >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t(language, "Save Clinic Hours")}
        </Button>
    )
}

export function ClinicHoursForm({ hours }: { hours: DayHours[] }) {
    const { language } = useLanguage()
    const [saved, setSaved] = useState(false)

    const [state, formAction] = useActionState<ClinicHoursState, FormData>(
        async (prev, formData) => {
            const result = await updateClinicHours(prev, formData)

            if (result.success) {
                setSaved(true)
                setTimeout(() => setSaved(false), 2500)
            }

            return result
        },
        {}
    )

    return (
        <Card className="border-none bg-card/60">
            <CardHeader>
                <div
                    className="flex items-center gap-3"
                    dir={language === "ar" ? "rtl" : "ltr"}
                >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                        <Clock className="h-5 w-5 text-primary" />
                    </div>

                    <div>
                        <CardTitle className="text-xl">
                            {t(language, "Clinic Opening Hours")}
                        </CardTitle>

                        <CardDescription>
                            {t(
                                language,
                                "The days and times the clinic is open. Doctor availability is kept within these hours."
                            )}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                <form
                    action={formAction}
                    className="space-y-5"
                    dir={language === "ar" ? "rtl" : "ltr"}
                >
                    <WeekEditor prefix="clinic" initial={hours} />

                    {state.error && (
                        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                            {t(language, state.error)}
                        </p>
                    )}

                    <div className="flex items-center justify-end gap-3">
                        {saved && (
                            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                                <CheckCircle2 className="h-4 w-4" />
                                {t(language, "Saved")}
                            </span>
                        )}

                        <SaveButton />
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
