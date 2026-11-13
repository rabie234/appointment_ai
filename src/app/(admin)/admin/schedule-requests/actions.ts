"use server";

import { isValidObjectId } from "mongoose";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import connectDB from "@/lib/mongodb";
import Appointment from "@/models/Appointment";
import Doctor from "@/models/Doctor";
import DoctorScheduleRequest from "@/models/DoctorScheduleRequest";
import { getClinicHours } from "@/lib/clinic-hours";
import {
  DAYS,
  normalizeWeek,
  slotsForDay,
  validateAgainstClinic,
  validateWeek,
} from "@/lib/schedule";
import { appointmentHasPassed } from "@/lib/appointment-transitions";
import {
  notifyDoctor,
  notifyUser,
} from "@/lib/notification-service";

type ScheduleReviewResult = {
  error?: string;
  success?: boolean;
};

function revalidateSchedulePages() {
  revalidatePath("/admin/schedule-requests");
  revalidatePath("/doctor/working-hours");
  revalidatePath("/admin/doctors");
  revalidatePath("/doctors");
  revalidatePath("/appointments");
}

function appointmentFitsRequestedSchedule(
  dateValue: Date,
  time: string,
  schedule: ReturnType<typeof normalizeWeek>
): boolean {
  const date = new Date(dateValue);
  const day = DAYS[(date.getUTCDay() + 6) % 7];
  const daySchedule = schedule.find((entry) => entry.day === day);

  return Boolean(
    daySchedule &&
      !daySchedule.closed &&
      slotsForDay(daySchedule).includes(time)
  );
}

export async function approveScheduleChange(
  requestId: string,
  adminNote = ""
): Promise<ScheduleReviewResult> {
  const session = await requireRole("admin");

  if (!isValidObjectId(requestId)) {
    return { error: "Invalid schedule request." };
  }

  await connectDB();

  const request = await DoctorScheduleRequest.findOne({
    _id: requestId,
    status: "pending",
  }).lean();

  if (!request) {
    return { error: "Pending schedule request not found." };
  }

  const doctor = await Doctor.findById(request.doctor)
    .select("_id")
    .lean();

  if (!doctor) {
    return { error: "Doctor not found." };
  }

  const requestedSchedule = normalizeWeek(request.requestedSchedule);

  const shape = validateWeek(requestedSchedule);
  if (!shape.ok) return { error: shape.error };

  const withinClinic = validateAgainstClinic(
    requestedSchedule,
    await getClinicHours()
  );

  if (!withinClinic.ok) {
    return { error: withinClinic.error };
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const appointments = await Appointment.find({
    doctor: doctor._id,
    date: { $gte: today },
    status: { $in: ["pending", "confirmed"] },
  })
    .select("date time")
    .lean();

  const futureAppointments = appointments.filter(
    (appointment) =>
      !appointmentHasPassed(appointment.date, appointment.time)
  );

  const hasConflicts = futureAppointments.some(
    (appointment) =>
      !appointmentFitsRequestedSchedule(
        appointment.date,
        appointment.time,
        requestedSchedule
      )
  );

  if (hasConflicts) {
    return {
      error:
        "The requested hours conflict with existing appointments. Adjust them or resolve the affected appointments before approval.",
    };
  }

  const now = new Date();
  const note = adminNote.trim().slice(0, 500);

  const claimed = await DoctorScheduleRequest.updateOne(
    { _id: requestId, status: "pending" },
    {
      $set: {
        status: "approved",
        reviewedBy: session.user.id,
        reviewedAt: now,
        adminNote: note || undefined,
      },
    }
  );

  if (claimed.modifiedCount === 0) {
    return { error: "This schedule request has already been reviewed." };
  }

  try {
    const updatedDoctor = await Doctor.updateOne(
      { _id: doctor._id },
      { $set: { schedule: requestedSchedule } }
    );

    if (updatedDoctor.matchedCount === 0) {
      throw new Error("Doctor not found.");
    }
  } catch (error) {
    await DoctorScheduleRequest.updateOne(
      {
        _id: requestId,
        status: "approved",
        reviewedBy: session.user.id,
      },
      {
        $set: { status: "pending" },
        $unset: {
          reviewedBy: "",
          reviewedAt: "",
          adminNote: "",
        },
      }
    );

    console.error("Apply approved schedule change failed:", error);

    return {
      error: "Could not apply the approved schedule. Please try again.",
    };
  }

  await Appointment.updateMany(
    { scheduleChangeRequestId: requestId },
    { $unset: { scheduleChangeRequestId: "" } }
  );

  await notifyDoctor(String(doctor._id), {
    category: "schedule",
    titleKey: "Notification: Working-hours change approved",
    bodyKey:
      "Notification body: Your requested working hours were approved.",
    href: "/doctor/working-hours",
  });

  revalidateSchedulePages();
  return { success: true };
}

export async function rejectScheduleChange(
  requestId: string,
  adminNote = ""
): Promise<ScheduleReviewResult> {
  const session = await requireRole("admin");

  if (!isValidObjectId(requestId)) {
    return { error: "Invalid schedule request." };
  }

  await connectDB();

  const request = await DoctorScheduleRequest.findOne({
    _id: requestId,
    status: "pending",
  })
    .select("doctor")
    .lean();

  if (!request) {
    return { error: "Pending schedule request not found." };
  }

  const result = await DoctorScheduleRequest.updateOne(
    { _id: requestId, status: "pending" },
    {
      $set: {
        status: "rejected",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        adminNote: adminNote.trim().slice(0, 500) || undefined,
      },
    }
  );

  if (result.modifiedCount === 0) {
    return { error: "Pending schedule request not found." };
  }

  await Appointment.updateMany(
    { scheduleChangeRequestId: requestId },
    { $unset: { scheduleChangeRequestId: "" } }
  );

  await notifyDoctor(String(request.doctor), {
    category: "schedule",
    titleKey: "Notification: Working-hours change rejected",
    bodyKey:
      "Notification body: Your requested working-hours change was rejected.",
    href: "/doctor/working-hours",
  });

  revalidateSchedulePages();
  return { success: true };
}

export async function requestPatientReschedule(
  requestId: string,
  appointmentId: string
): Promise<ScheduleReviewResult> {
  await requireRole("admin");

  if (!isValidObjectId(requestId) || !isValidObjectId(appointmentId)) {
    return { error: "Invalid schedule request." };
  }

  await connectDB();

  const request = await DoctorScheduleRequest.findOne({
    _id: requestId,
    status: "pending",
  })
    .select("doctor requestedSchedule")
    .lean();

  if (!request) {
    return {
      error: "Schedule request not found or no longer pending.",
    };
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const appointment = await Appointment.findOne({
    _id: appointmentId,
    doctor: request.doctor,
    date: { $gte: today },
    status: { $in: ["pending", "confirmed"] },
  })
    .select("patient date time scheduleChangeRequestId")
    .lean();

  if (
    !appointment ||
    appointmentHasPassed(appointment.date, appointment.time)
  ) {
    return {
      error:
        "Appointment not found or no longer eligible for rescheduling.",
    };
  }

  const requestedSchedule = normalizeWeek(request.requestedSchedule);
  const stillConflicts = !appointmentFitsRequestedSchedule(
    appointment.date,
    appointment.time,
    requestedSchedule
  );

  if (!stillConflicts) {
    return {
      error:
        "This appointment no longer conflicts with the requested hours.",
    };
  }

  const existingRequestId = appointment.scheduleChangeRequestId
    ? String(appointment.scheduleChangeRequestId)
    : "";

  if (existingRequestId === requestId) {
    return { success: true };
  }

  if (existingRequestId) {
    return {
      error: "This appointment already has a reschedule request.",
    };
  }

  const updated = await Appointment.updateOne(
    {
      _id: appointmentId,
      doctor: request.doctor,
      status: { $in: ["pending", "confirmed"] },
      $or: [
        { scheduleChangeRequestId: { $exists: false } },
        { scheduleChangeRequestId: null },
      ],
    },
    {
      $set: { scheduleChangeRequestId: request._id },
    }
  );

  if (updated.modifiedCount === 0) {
    return {
      error: "This appointment already has a reschedule request.",
    };
  }

  await notifyUser(String(appointment.patient), {
    category: "appointment",
    titleKey: "Notification: Choose a new time for your appointment",
    bodyKey:
      "Notification body: Your doctor requested a working-hours change that affects your appointment. Please choose a new time.",
    href: "/appointments",
    context:
      `${new Date(appointment.date).toISOString().slice(0, 10)} · ` +
      appointment.time,
  });

  revalidatePath("/appointments");
  revalidatePath("/admin/schedule-requests");

  return { success: true };
}