import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { AdminTopbar } from "@/components/layout/admin-topbar"
import { requireRole } from "@/lib/session"

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Re-asserted server-side, not just in middleware.
    const session = await requireRole("admin")

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            <AdminSidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <AdminTopbar user={session.user} />
                <main className="flex-1 p-6 lg:p-10 overflow-x-hidden">
                    <div className="max-w-7xl mx-auto space-y-10">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
