
"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"
import DoctorLeaveDialog from "./doctor-leave-dialog"

type DoctorOption = {
    id: string
    name: string
    nameAr: string
    specialty: string
}

export default function DoctorLeavesHeading({
    doctors,
}: {
    doctors: DoctorOption[]
}) {
    const { language } = useLanguage()
    const [open, setOpen] = useState(false)

    return (
        <>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {t(language, "Doctor Leaves")}
                    </h1>

                    <p className="mt-1 text-muted-foreground">
                        {t(language, "View and manage scheduled doctor leave.")}
                    </p>
                </div>

                <Button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="gap-2"
                    disabled={doctors.length === 0}
                >
                    <Plus className="h-4 w-4" />
                    {t(language, "Schedule Leave")}
                </Button>
            </div>

            <DoctorLeaveDialog
                open={open}
                doctors={doctors}
                onClose={() => setOpen(false)}
            />
        </>
    )
}
