"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WeekEditor } from "@/components/schedule/week-editor"
import { Clock, Loader2, CheckCircle2 } from "lucide-react"
import { type DayHours } from "@/lib/schedule"
import { updateClinicHours, type ClinicHoursState } from "./actions"

function SaveButton() {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending} className="gap-2 shadow-lg shadow-blue-200">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Clinic Hours
        </Button>
    )
}

export function ClinicHoursForm({ hours }: { hours: DayHours[] }) {
    const [saved, setSaved] = useState(false)

    // Wrap the action so we flash "Saved" from the result (an event callback),
    // instead of reacting to state in an effect.
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
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                        <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">Clinic Opening Hours</CardTitle>
                        <CardDescription>
                            The days and times the clinic is open. Doctor availability is kept within these hours.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <form action={formAction} className="space-y-5">
                    <WeekEditor prefix="clinic" initial={hours} />

                    {state.error && (
                        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                            {state.error}
                        </p>
                    )}

                    <div className="flex items-center justify-end gap-3">
                        {saved && (
                            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                                <CheckCircle2 className="h-4 w-4" />
                                Saved
                            </span>
                        )}
                        <SaveButton />
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
