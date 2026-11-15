import { DoctorSidebar, DoctorMobileNav } from "@/components/layout/doctor-sidebar"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { requireRole } from "@/lib/session"

export default async function DoctorLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Re-asserted server-side, not just in the proxy.
    const session = await requireRole("doctor")

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            <DoctorSidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <AdminTopbar user={session.user} />
                <DoctorMobileNav />
                <main className="flex-1 p-6 lg:p-10 overflow-x-hidden">
                    <div className="max-w-7xl mx-auto space-y-10">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
