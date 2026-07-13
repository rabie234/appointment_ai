import { PatientNavbar } from "@/components/layout/patient-navbar"
import { requireRole } from "@/lib/session"

export default async function PatientLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Covers "/" too — the home page lives in this group and is NOT public.
    const session = await requireRole("patient")

    return (
        <div className="relative min-h-screen flex flex-col bg-background">
            <PatientNavbar user={session.user} />
            <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
            <footer className="border-t py-6 md:py-0">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
                    <p className="text-sm text-muted-foreground">
                        &copy; 2026 ClinicAI Healthcare. All rights reserved.
                    </p>
                    <div className="flex items-center space-x-4">
                        <a href="#" className="text-sm text-muted-foreground hover:underline">Privacy Policy</a>
                        <a href="#" className="text-sm text-muted-foreground hover:underline">Terms of Service</a>
                    </div>
                </div>
            </footer>
        </div>
    )
}
