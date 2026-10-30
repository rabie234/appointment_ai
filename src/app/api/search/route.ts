import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { auth } from "@/lib/auth";
import User from "@/models/User";
import Doctor from "@/models/Doctor";
import Appointment from "@/models/Appointment";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    if (query.length > 100) {
      return NextResponse.json(
        { error: "Search query is too long." },
        { status: 400 }
      );
    }

    await connectDB();

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    const [patients, doctors, matchingAppointments] = await Promise.all([
      User.find({
        role: "patient",
        $or: [
          { name: regex },
          { email: regex },
          { phone: regex },
        ],
      })
        .select("name email phone")
        .limit(5)
        .lean(),

      Doctor.find({
        $or: [
          { name: regex },
          { nameAr: regex },
          { specialty: regex },
          { email: regex },
        ],
      })
        .select("name nameAr specialty status")
        .limit(5)
        .lean(),

     Appointment.find({
  status: regex,
})
  .populate({
    path: "patient",
    select: "name",
  })
  .populate({
    path: "doctor",
    select: "name nameAr specialty",
  })
  .sort({ date: -1 })
  .limit(100)
  .lean(),
    ]);

    const appointments = matchingAppointments.filter((appointment) => {
  const patient = appointment.patient as { name?: string } | null;
  const doctor = appointment.doctor as {
    name?: string;
    nameAr?: string;
    specialty?: string;
  } | null;

  return (
    regex.test(appointment.status ?? "") ||
    regex.test(patient?.name ?? "") ||
    regex.test(doctor?.name ?? "") ||
    regex.test(doctor?.nameAr ?? "") ||
    regex.test(doctor?.specialty ?? "")
  );
});

    const results = [
      ...patients.map((patient) => ({
        id: String(patient._id),
        type: "patient" as const,
        title: patient.name,
        subtitle: patient.email ?? patient.phone ?? "",
        href: `/admin/patients?patientId=${encodeURIComponent(String(patient._id))}`,
      })),

      ...doctors.map((doctor) => ({
        id: String(doctor._id),
        type: "doctor" as const,
        title: doctor.name,
        subtitle: doctor.specialty ?? "",
        href: "/admin/doctors",
      })),

      ...appointments.slice(0, 5).map((appointment) => {
        const patient = appointment.patient as
          | { name?: string }
          | null;
        const doctor = appointment.doctor as
          | { name?: string; specialty?: string }
          | null;

        return {
          id: String(appointment._id),
          type: "appointment" as const,
          title: patient?.name ?? "Appointment",
          subtitle: `${doctor?.name ?? "Unknown doctor"} · ${appointment.status}`,
          href: `/admin/appointments?appointmentId=${encodeURIComponent(String(appointment._id))}`,
        };
      }),
    ];

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Admin global search failed:", error);

    return NextResponse.json(
      { error: "Unable to search records." },
      { status: 500 }
    );
  }
}