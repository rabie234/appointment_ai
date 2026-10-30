
"use client"

import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"

export default function DoctorLeavesHeading() {
    const { language } = useLanguage()

    return (
        <div>
            <h1 className="text-3xl font-bold tracking-tight">
                {t(language, "Doctor Leaves")}
            </h1>

            <p className="mt-1 text-muted-foreground">
                {t(
                    language,
                    "View and manage scheduled doctor leave."
                )}
            </p>
        </div>
    )
}
