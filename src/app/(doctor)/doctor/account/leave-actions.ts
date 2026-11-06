"use server";

import { revalidatePath } from "next/cache";
import connectDB from "@/lib/mongodb";
import { requireDoctor } from "@/lib/doctor-session";
import DoctorLeave from "@/models/DoctorLeave";

export type LeaveRequestState = {
  error?: string;
  success?: string;
};
export async function requestMyLeave(
  _prev: LeaveRequestState,
  formData: FormData,
): Promise<LeaveRequestState> {
  const { doctor } = await requireDoctor();
  if (!doctor) {
    return { error: "No doctor profile is linked to this account" };
  }

  const startStr = String(formData.get("startDate") ?? "").trim();
  const endStr = String(formData.get("endDate") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startStr) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endStr)) {
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

  // Store the end as exclusive, matching the existing leave code.
  const exclusiveEnd = new Date(endDate);
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);

  await connectDB();

  const overlappingRequest = await DoctorLeave.exists({
  doctor: doctor._id,
  startDate: { $lt: exclusiveEnd },
  endDate: { $gt: startDate },
  $or: [
    { status: { $in: ["pending", "approved"] } },
    // Older Admin-created leave records have no status field.
    { status: { $exists: false } },
  ],
})

  if (overlappingRequest) {
    return { error: "You already have a pending or approved leave in these dates." };
  }

  try {
    await DoctorLeave.create({
      doctor: doctor._id,
      startDate,
      endDate: exclusiveEnd,
      reason: reason || undefined,
      status: "pending",
    });
  } catch (error) {
    console.error("Submit doctor leave request failed:", error);
    return { error: "Could not submit your leave request. Please try again." };
  }
  revalidatePath("/admin/doctor-leaves");
  revalidatePath("/doctor/leaves")

  return { success: "Leave request submitted for administrator approval." };
}
export async function cancelMyLeaveRequest(
  leaveId: string,
): Promise<LeaveRequestState> {
  const { doctor } = await requireDoctor()

  if (!doctor) {
    return { error: "No doctor profile is linked to this account" }
  }

  if (!/^[a-f\d]{24}$/i.test(leaveId)) {
    return { error: "Invalid leave request." }
  }

  await connectDB()

  try {
    const result = await DoctorLeave.updateOne(
      {
        _id: leaveId,
        doctor: doctor._id,
        status: "pending",
      },
      {
        $set: { status: "cancelled" },
      },
    )

    if (result.modifiedCount === 0) {
      return {
        error: "Pending leave request not found. It may already have been reviewed.",
      }
    }
    revalidatePath("/admin/doctor-leaves")
    revalidatePath("/doctor/leaves")

    return { success: "Leave request cancelled." }
  } catch (error) {
    console.error("Cancel doctor leave request failed:", error)
    return { error: "Could not cancel your leave request. Please try again." }
  }
}