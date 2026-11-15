import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";

import connectDB from "@/lib/mongodb";
import { requireRole } from "@/lib/session";
import { intersectSchedules, normalizeWeek } from "@/lib/schedule";
import { getClinicHours } from "@/lib/clinic-hours";

import Doctor from "@/models/Doctor";
import Appointment from "@/models/Appointment";

import DoctorProfileDisplay from "./doctor-profile-display";

export const dynamic = "force-dynamic";

const CONSULTATION_FEE = 120;

export default async function DoctorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("patient");

  const { id } = await params;

  if (!isValidObjectId(id)) notFound();

  await connectDB();

  const doctor = await Doctor.findById(id).lean();

  if (!doctor) notFound();

  const [appointmentCounts, uniquePatients] = await Promise.all([
    Appointment.aggregate([
      {
        $match: {
          doctor: doctor._id,
          status: { $in: ["completed", "missed"] },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    Appointment.distinct("patient", {
      doctor: doctor._id,
      status: "completed",
    }),
  ]);

  const completedCount =
    appointmentCounts.find((item) => item._id === "completed")?.count ?? 0;

  const missedCount =
    appointmentCounts.find((item) => item._id === "missed")?.count ?? 0;

  const totalEligibleAppointments = completedCount + missedCount;

  const successRate =
    totalEligibleAppointments > 0
      ? Math.round((completedCount / totalEligibleAppointments) * 100)
      : null;

  const totalPatients = uniquePatients.length;

  // Patients see only the overlap between doctor hours and clinic hours.
  const schedule = intersectSchedules(
    normalizeWeek(doctor.schedule),
    await getClinicHours()
  );

  const workingDays = schedule
    .filter((day) => !day.closed)
    .map((day) => ({
      day: day.day,
      intervals:
        day.intervals ??
        (day.open && day.close
          ? [{ open: day.open, close: day.close }]
          : []),
    }));

  return (
    <DoctorProfileDisplay
      doctor={{
        id: String(doctor._id),
        name: doctor.name,
        nameAr: doctor.nameAr || "",
        image: doctor.image || "",
        specialty: doctor.specialty,
        experience: doctor.experience,
        successRate,
        totalPatients,
        active: doctor.status === "active",
      }}
      workingDays={workingDays}
      openWeekdays={workingDays.map((day) => day.day)}
      consultationFee={CONSULTATION_FEE}
    />
  );
}