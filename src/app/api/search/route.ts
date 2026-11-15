
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

    const role = session.user.role;

    if (role !== "admin" && role !== "doctor") {
      return NextResponse.json(
        { error: "Access denied." },
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

    // DOCTOR SEARCH
    if (role === "doctor") {
      const doctor = await Doctor.findOne({
        user: session.user.id,
      }).select("_id");

      if (!doctor) {
        return NextResponse.json(
          { error: "Doctor profile not found." },
          { status: 403 }
        );
      }

      const patients = await User.find({
        role: "patient",
        $or: [
          { name: regex },
          { email: regex },
          { phone: regex },
        ],
      })
        .select("name email phone")
        .limit(20)
        .lean();

      const patientIds = patients.map((patient) => patient._id);

      const appointmentConditions: Record<string, unknown>[] = [
        { status: regex },
      ];

      if (patientIds.length > 0) {
        appointmentConditions.push({
          patient: { $in: patientIds },
        });
      }

      const appointments = await Appointment.find({
        doctor: doctor._id,
        $or: appointmentConditions,
      })
        .populate("patient", "name email phone")
        .sort({ date: -1 })
        .limit(20)
        .lean();

      const matchingPatientIds = new Set(
        appointments.map((appointment) =>
          String(
            typeof appointment.patient === "object" &&
            appointment.patient !== null
              ? (appointment.patient as { _id: unknown })._id
              : appointment.patient
          )
        )
      );

      const results = [
        ...patients
          .filter((patient) =>
            matchingPatientIds.has(String(patient._id))
          )
          .slice(0, 5)
          .map((patient) => ({
            id: String(patient._id),
            type: "patient" as const,
            title: patient.name,
            subtitle: patient.email ?? patient.phone ?? "",
            href: "/doctor/appointments",
          })),

        ...appointments.slice(0, 5).map((appointment) => {
          const patient = appointment.patient as
            | { _id: unknown; name?: string }
            | null;

          return {
            id: String(appointment._id),
            type: "appointment" as const,
            title: patient?.name ?? "Unknown patient",
            subtitle: "My appointment",
            status: appointment.status,
            date: new Date(appointment.date)
              .toISOString()
              .slice(0, 10),
            time: appointment.time,
            href: "/doctor/appointments",
          };
        }),
      ];

      return NextResponse.json({ results });
    }

    // ADMIN SEARCH - preserve existing behavior
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

    const patientIds = patients.map((patient) => patient._id);
    const doctorIds = doctors.map((doctor) => doctor._id);

    const appointmentConditions = [
      { status: regex },
      ...(patientIds.length > 0
        ? [{ patient: { $in: patientIds } }]
        : []),
      ...(doctorIds.length > 0
        ? [{ doctor: { $in: doctorIds } }]
        : []),
    ];

    const appointments = await Appointment.find({
      $or: appointmentConditions,
    })
      .populate("patient", "name")
      .populate("doctor", "name nameAr specialty")
      .sort({ date: -1 })
      .limit(20)
      .lean();

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
          | { name?: string }
          | null;

        return {
          id: String(appointment._id),
          type: "appointment" as const,
          title: patient?.name ?? "Unknown patient",
          subtitle: doctor?.name ?? "Unknown doctor",
          status: appointment.status,
          date: new Date(appointment.date)
            .toISOString()
            .slice(0, 10),
          time: appointment.time,
          href: `/admin/appointments?appointmentId=${encodeURIComponent(String(appointment._id))}`,
        };
      }),
    ];

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Global search failed:", error);

    return NextResponse.json(
      { error: "Unable to search records." },
      { status: 500 }
    );
  }
}
