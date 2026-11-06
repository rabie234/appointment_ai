
"use server";

import { revalidatePath } from "next/cache";
import connectDB from "@/lib/mongodb";
import { requireRole } from "@/lib/session";
import Doctor from "@/models/Doctor";
import DoctorLeave from "@/models/DoctorLeave";
import Appointment from "@/models/Appointment";
import { notifyDoctor, notifyPatientsAffectedByLeave, notifyUser } from "@/lib/notification-service";

export type LeaveActionState = {
  error?: string;
  success?: boolean;
  affectedCount?: number;
};

export async function createDoctorLeave(
  _prev: LeaveActionState,
  formData: FormData,
  
  
): Promise<LeaveActionState> {
  const session = await requireRole("admin");

  const doctorId = String(formData.get("doctorId") ?? "").trim();
  const startStr = String(formData.get("startDate") ?? "").trim();
  const endStr = String(formData.get("endDate") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!doctorId || !startStr || !endStr) {
    return { error: "Doctor, start date, and end date are required." };
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startStr) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endStr)
  ) {
    return { error: "Please provide valid leave dates." };
  }

  const startDate = new Date(`${startStr}T00:00:00.000Z`);
  const endDate = new Date(`${endStr}T00:00:00.000Z`);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    startDate.toISOString().slice(0, 10) !== startStr ||
    endDate.toISOString().slice(0, 10) !== endStr
  ) {
    return { error: "Please provide valid leave dates." };
  }

  if (endDate < startDate) {
    return { error: "The end date must be on or after the start date." };
  }

  await connectDB();

  const doctor = await Doctor.findById(doctorId).select("_id").lean();
  if (!doctor) return { error: "Doctor not found." };

  const exclusiveEnd = new Date(endDate);
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
  const overlappingLeave = await DoctorLeave.exists({
  doctor: doctor._id,
  startDate: { $lt: exclusiveEnd },
  endDate: { $gt: startDate },
  $or: [
    { status: { $in: ["pending", "approved"] } },
    // Older Admin-created leave records have no status field.
    { status: { $exists: false } },
  ],
})

if (overlappingLeave) {
  return {
    error: "These dates overlap another pending or approved leave.",
  }
}
  try {
    await DoctorLeave.create({
  doctor: doctor._id,
  startDate,
  endDate: exclusiveEnd,
  reason: reason || undefined,
  status: "approved",
reviewedBy: session.user.id,
reviewedAt: new Date(),
});

    const affected = await Appointment.updateMany(
      {
        doctor: doctor._id,
        date: { $gte: startDate, $lt: exclusiveEnd },
        status: { $in: ["pending", "confirmed"] },
      },
      {
        $set: { leaveConflict: true },
      }
    );

    await Promise.all([
      notifyDoctor(String(doctor._id), {
        category: "leave",
        titleKey: "Notification: Leave scheduled by clinic",
        bodyKey: "Notification body: The clinic scheduled an approved leave period for you.",
        href: "/doctor/leaves",
        context: startStr + " – " + endStr,
      }),
      notifyPatientsAffectedByLeave(String(doctor._id), startDate, exclusiveEnd),
    ]);

    revalidatePath("/admin/doctors");
    revalidatePath("/admin/appointments");
    revalidatePath("/appointments");
    revalidatePath("/patient/appointments");

    return {
      success: true,
      affectedCount: affected.modifiedCount,
    };
  } catch (error) {
    console.error("Create doctor leave failed:", error);
    return { error: "Could not schedule doctor leave. Please try again." };
  }
}

export async function cancelDoctorLeave(
  leaveId: string
): Promise<LeaveActionState> {
  const session = await requireRole("admin");
  await connectDB();

  if (!/^[a-f\d]{24}$/i.test(leaveId)) {
    return { error: "Invalid leave record." };
  }

  try {
    const leave = await DoctorLeave.findById(leaveId).lean();

    if (!leave) {
      return { error: "Leave record not found." };
    }

    const { doctor: doctorId, startDate, endDate } = leave;

    // Remove the leave record first.
    // Keep the record for history, but mark it cancelled.
await DoctorLeave.updateOne(
  { _id: leave._id },
  {
    $set: {
      status: "cancelled",
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
    },
  },
);

    // Find appointments in this date range that are still covered
    // by another leave record for the same doctor.
    const appointments = await Appointment.find({
      doctor: doctorId,
      date: { $gte: startDate, $lt: endDate },
      leaveConflict: true,
      status: { $in: ["pending", "confirmed"] },
    })
      .select("_id patient date time")
      .lean();

    for (const appointment of appointments) {
      const stillOnLeave = await DoctorLeave.exists({
  _id: { $ne: leave._id },
  doctor: doctorId,
  startDate: { $lte: appointment.date },
  endDate: { $gt: appointment.date },
  $or: [
    { status: "approved" },
    // Older Admin-created leave records have no status field.
    { status: { $exists: false } },
  ],
})
      if (!stillOnLeave) {
        await Appointment.updateOne(
          { _id: appointment._id },
          { $set: { leaveConflict: false } }
        );
        await notifyUser(String(appointment.patient), {
          category: "appointment",
          titleKey: "Notification: Appointment no longer affected by leave",
          bodyKey: "Notification body: The leave affecting your appointment was cancelled. Your booking remains active.",
          href: "/appointments",
          context:
            new Date(appointment.date).toISOString().slice(0, 10) +
            " · " +
            appointment.time,
        });
      }
    }

    await notifyDoctor(String(doctorId), {
      category: "leave",
      titleKey: "Notification: Doctor leave cancelled",
      bodyKey: "Notification body: An approved leave period was cancelled by the clinic.",
      href: "/doctor/leaves",
    });

    revalidatePath("/admin/doctor-leaves");
    revalidatePath("/admin/doctors");
    revalidatePath("/admin/appointments");
    revalidatePath("/appointments");
    revalidatePath("/patient/appointments");

    return { success: true };
  } catch (error) {
    console.error("Cancel doctor leave failed:", error);
    return { error: "Could not cancel leave. Please try again." };
  }
}
export async function approveDoctorLeave(
  leaveId: string,
  adminNote = "",
): Promise<LeaveActionState> {
  const session = await requireRole("admin");

  if (!/^[a-f\d]{24}$/i.test(leaveId)) {
    return { error: "Invalid leave record." };
  }

  await connectDB();

  const leave = await DoctorLeave.findOne({
    _id: leaveId,
    status: "pending",
  }).lean();

  if (!leave) {
    return { error: "Pending leave request not found." };
  }

  const overlap = await DoctorLeave.exists({
    _id: { $ne: leave._id },
    doctor: leave.doctor,
    startDate: { $lt: leave.endDate },
    endDate: { $gt: leave.startDate },
    $or: [
      { status: "approved" },
      // Older Admin-created records have no status field; treat them as approved.
      { status: { $exists: false } },
    ],
  });

  if (overlap) {
    return {
      error: "This request overlaps an existing approved leave.",
    };
  }

  const updated = await DoctorLeave.updateOne(
    { _id: leave._id, status: "pending" },
    {
      $set: {
        status: "approved",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        adminNote: adminNote.trim().slice(0, 500),
      },
    },
  );

  if (updated.modifiedCount === 0) {
    return { error: "This request has already been reviewed." };
  }

  const affected = await Appointment.updateMany(
    {
      doctor: leave.doctor,
      date: { $gte: leave.startDate, $lt: leave.endDate },
      status: { $in: ["pending", "confirmed"] },
    },
    { $set: { leaveConflict: true } },
  );

  await Promise.all([
    notifyDoctor(String(leave.doctor), {
      category: "leave",
      titleKey: "Notification: Doctor leave approved",
      bodyKey: "Notification body: Your leave request was approved.",
      href: "/doctor/leaves",
    }),
    notifyPatientsAffectedByLeave(String(leave.doctor), leave.startDate, leave.endDate),
  ]);

  revalidatePath("/admin/doctor-leaves");
  revalidatePath("/admin/doctors");
  revalidatePath("/admin/appointments");
  revalidatePath("/appointments");
  revalidatePath("/patient/appointments");
  revalidatePath("/doctor/account");

  return { success: true, affectedCount: affected.modifiedCount };
}

export async function rejectDoctorLeave(
  leaveId: string,
  adminNote = "",
): Promise<LeaveActionState> {
  const session = await requireRole("admin");

  if (!/^[a-f\d]{24}$/i.test(leaveId)) {
    return { error: "Invalid leave record." };
  }

  await connectDB();

  const leave = await DoctorLeave.findOne({
    _id: leaveId,
    status: "pending",
  }).select("doctor").lean();

  if (!leave) {
    return { error: "Pending leave request not found." };
  }

  const result = await DoctorLeave.updateOne(
    { _id: leaveId, status: "pending" },
    {
      $set: {
        status: "rejected",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        adminNote: adminNote.trim().slice(0, 500),
      },
    },
  );

  if (result.modifiedCount === 0) {
    return { error: "Pending leave request not found." };
  }

  await notifyDoctor(String(leave.doctor), {
    category: "leave",
    titleKey: "Notification: Doctor leave rejected",
    bodyKey: "Notification body: Your leave request was rejected.",
    href: "/doctor/leaves",
  });

  revalidatePath("/admin/doctor-leaves");
  revalidatePath("/doctor/account");

  return { success: true };
}