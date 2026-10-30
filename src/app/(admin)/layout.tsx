
import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { requireRole } from "@/lib/session"

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await requireRole("admin")

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            <AdminSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <AdminTopbar user={session.user} />
                <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-10">
                    <div className="mx-auto max-w-7xl space-y-10">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
