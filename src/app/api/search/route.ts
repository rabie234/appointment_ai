
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { auth } from "@/lib/auth";
import User from "@/models/User";
import Doctor from "@/models/Doctor";
import Appointment from "@/models/Appointment";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    // 2. Authorization
    if (session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    // 3. Validate search query
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

    // 4. Create a safe case-insensitive search pattern
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    // 5. Search patients and doctors first
    const [patients, doctors] = await Promise.all([
      User.find({
        role: "patient",
        $or: [
          { name: regex },
          { email: regex },
          { phone: regex },
        ],
      })
        .select("name email phone")
        .limit(20)
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
        .limit(20)
        .lean(),
    ]);

    // 6. Collect matching patient and doctor IDs
    const patientIds = patients.map((patient) => patient._id);
    const doctorIds = doctors.map((doctor) => doctor._id);

    // 7. Build appointment search conditions
    const appointmentConditions = [
      { status: regex },

      ...(patientIds.length > 0
        ? [{ patient: { $in: patientIds } }]
        : []),

      ...(doctorIds.length > 0
        ? [{ doctor: { $in: doctorIds } }]
        : []),
    ];

    // 8. Search appointments by status, patient, or doctor
    const appointments = await Appointment.find({
      $or: appointmentConditions,
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
      .limit(20)
      .lean();

    // 9. Prepare global search results
    const results = [
      ...patients.slice(0, 5).map((patient) => ({
        id: String(patient._id),
        type: "patient" as const,
        title: patient.name,
        subtitle: patient.email ?? patient.phone ?? "",
        href: `/admin/patients?patientId=${encodeURIComponent(String(patient._id))}`,
      })),

      ...doctors.slice(0, 5).map((doctor) => ({
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
    | { name?: string; nameAr?: string; specialty?: string }
    | null;

  return {
    id: String(appointment._id),
    type: "appointment" as const,
    title: patient?.name ?? "Unknown patient",
    subtitle: doctor?.name ?? "Unknown doctor",
    status: appointment.status,
    date: new Date(appointment.date).toISOString().slice(0, 10),
    time: appointment.time,
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
