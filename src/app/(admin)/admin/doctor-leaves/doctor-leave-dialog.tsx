
"use client"

import { useActionState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"
import {
    createDoctorLeave,
    type LeaveActionState,
} from "../doctors/leave-actions"

type DoctorOption = {
    id: string
    name: string
    nameAr: string
    specialty: string
}

function SubmitButton() {
    const { pending } = useFormStatus()
    const { language } = useLanguage()

    return (
        <Button type="submit" disabled={pending}>
            {pending
                ? t(language, "Please wait...")
                : t(language, "Schedule Leave")}
        </Button>
    )
}

export default function DoctorLeaveDialog({
    open,
    doctors,
    onClose,
}: {
    open: boolean
    doctors: DoctorOption[]
    onClose: () => void
}) {
    const { language } = useLanguage()

    const [state, formAction] = useActionState<LeaveActionState, FormData>(
        createDoctorLeave,
        {}
    )

    useEffect(() => {
        if (state.success) {
            onClose()
        }
    }, [state.success, onClose])

    return (
        <Dialog open={open} onOpenChange={(value) => {
            if (!value) onClose()
        }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {t(language, "Schedule Doctor Leave")}
                    </DialogTitle>
                    <DialogDescription>
                        {t(language, "Mark leave dates and flag affected appointments.")}
                    </DialogDescription>
                </DialogHeader>

                <form action={formAction} className="space-y-4">
                    <div className="space-y-2">
                        <label>{t(language, "Doctor")}</label>
                        <select
                            name="doctorId"
                            required
                            defaultValue=""
                            className="w-full rounded-md border bg-background p-2 text-sm"
                        >
                            <option value="" disabled>
                                {t(language, "Select a doctor")}
                            </option>

                            {doctors.map((doctor) => (
                                <option key={doctor.id} value={doctor.id}>
                                    {language === "ar"
                                        ? doctor.nameAr || doctor.name
                                        : doctor.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label>{t(language, "Start Date")}</label>
                        <Input name="startDate" type="date" required />
                    </div>

                    <div className="space-y-2">
                        <label>{t(language, "End Date")}</label>
                        <Input name="endDate" type="date" required />
                    </div>

                    <div className="space-y-2">
                        <label>{t(language, "Reason")}</label>
                        <Input name="reason" maxLength={300} />
                    </div>

                    {state.error && (
                        <p className="text-sm text-destructive">
                            {state.error}
                        </p>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            {t(language, "Cancel")}
                        </Button>

                        <SubmitButton />
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
