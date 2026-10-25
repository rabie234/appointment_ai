
"use server";

import { revalidatePath } from "next/cache";
import connectDB from "@/lib/mongodb";
import { requireRole } from "@/lib/session";
import Doctor from "@/models/Doctor";
import DoctorLeave from "@/models/DoctorLeave";
import Appointment from "@/models/Appointment";

export type LeaveActionState = {
  error?: string;
  success?: boolean;
  affectedCount?: number;
};

export async function createDoctorLeave(
  _prev: LeaveActionState,
  formData: FormData
): Promise<LeaveActionState> {
  await requireRole("admin");

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

  try {
    const leave = await DoctorLeave.create({
      doctor: doctor._id,
      startDate,
      endDate: exclusiveEnd,
      reason: reason || undefined,
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
  await requireRole("admin");
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
    await DoctorLeave.deleteOne({ _id: leave._id });

    // Find appointments in this date range that are still covered
    // by another leave record for the same doctor.
    const appointments = await Appointment.find({
      doctor: doctorId,
      date: { $gte: startDate, $lt: endDate },
      leaveConflict: true,
      status: { $in: ["pending", "confirmed"] },
    })
      .select("_id date")
      .lean();

    for (const appointment of appointments) {
      const stillOnLeave = await DoctorLeave.exists({
        doctor: doctorId,
        startDate: { $lte: appointment.date },
        endDate: { $gt: appointment.date },
      });

      if (!stillOnLeave) {
        await Appointment.updateOne(
          { _id: appointment._id },
          { $set: { leaveConflict: false } }
        );
      }
    }

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
