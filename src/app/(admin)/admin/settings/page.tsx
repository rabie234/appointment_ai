import { requireRole } from "@/lib/session"
import { getClinicHours } from "@/lib/clinic-hours"
import { ClinicHoursForm } from "./clinic-hours-form"

export const dynamic = "force-dynamic"

export default async function AdminSettingsPage() {
    await requireRole("admin")
    const hours = await getClinicHours()

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-1">Configure clinic-wide preferences.</p>
            </div>

            <ClinicHoursForm hours={hours} />
        </div>
    )
}
