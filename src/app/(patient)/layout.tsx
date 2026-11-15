import { PatientNavbar } from "@/components/layout/patient-navbar"
import { PatientFooter } from "@/components/layout/patient-footer"
import { requireRole } from "@/lib/session"

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireRole("patient")

  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      <PatientNavbar user={session.user} />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
      <PatientFooter />
    </div>
  )
}
