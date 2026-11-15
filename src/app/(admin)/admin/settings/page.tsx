
import { requireRole } from "@/lib/session"
import { getClinicHours } from "@/lib/clinic-hours"
import { ClinicHoursForm } from "./clinic-hours-form"
import { cookies } from "next/headers"
import { t } from "@/components/i18n/translations"
import type { Language } from "@/components/i18n/language-provider"

export const dynamic = "force-dynamic"

export default async function AdminSettingsPage() {
    await requireRole("admin")

    const hours = await getClinicHours()
    const cookieStore = await cookies()

    const language: Language =
        cookieStore.get("clinicai-language")?.value === "ar" ? "ar" : "en"

    return (
        <div
            className="space-y-8 animate-in fade-in duration-500"
            dir={language === "ar" ? "rtl" : "ltr"}
        >
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    {t(language, "Settings")}
                </h1>

                <p className="text-muted-foreground mt-1">
                    {t(language, "Configure clinic-wide preferences.")}
                </p>
            </div>

            <ClinicHoursForm hours={hours} />
        </div>
    )
}
