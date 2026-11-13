"use server";

import { revalidatePath } from "next/cache";
import connectDB from "@/lib/mongodb";
import { requireRole } from "@/lib/session";
import ClinicHours from "@/models/ClinicHours";
import Appointment from "@/models/Appointment";
import Doctor from "@/models/Doctor";
import {
  dayOfWeek,
  intersectSchedules,
  normalizeWeek,
  slotsForDay,
  validateWeek,
  weekFromFormData,
  type DayHours,
} from "@/lib/schedule";
import {
  notifyAdmins,
  notifyAppointmentParties,
  notifyUser,
} from "@/lib/notification-service";

export type ClinicHoursState = {
  error?: string;
  success?: boolean;
};

function daySignature(day: DayHours): string {
  return JSON.stringify([
    day.closed,
    day.closed ? [] : day.intervals ?? [{ open: day.open, close: day.close }],
  ]);
}

export async function updateClinicHours(
  _prev: ClinicHoursState,
  formData: FormData
): Promise<ClinicHoursState> {
  await requireRole("admin");

  const week = weekFromFormData(formData, "clinic");
  const validation = validateWeek(week);

  if (!validation.ok) {
    return { error: validation.error };
  }

  await connectDB();

  try {
    const previousClinic = await ClinicHours.findOne({ key: "clinic" })
      .select("hours")
      .lean();

    const previousWeek = normalizeWeek(previousClinic?.hours);
    const previousByDay = new Map(
      previousWeek.map((day) => [day.day, day])
    );

    const changedDays = week
      .filter((day) => {
        const previousDay = previousByDay.get(day.day);
        return !previousDay ||
          daySignature(previousDay) !== daySignature(day);
      })
      .map((day) => day.day);

    const clinicHoursChanged = changedDays.length > 0;

    await ClinicHours.findOneAndUpdate(
      { key: "clinic" },
      {
        $set: {
          key: "clinic",
          hours: week,
          ...(clinicHoursChanged ? { lastChangedDays: changedDays } : {}),
        },
        ...(clinicHoursChanged ? { $inc: { version: 1 } } : {}),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Closed clinic days become doctor Off days. Keep their saved intervals
    // so they can be restored if the doctor is later marked available.
    const closedDays = week
      .filter((day) => day.closed)
      .map((day) => day.day);

    await Promise.all(
      closedDays.map((day) =>
        Doctor.updateMany(
          { "schedule.day": day },
          {
            $set: {
              "schedule.$[closedDay].closed": true,
            },
          },
          { arrayFilters: [{ "closedDay.day": day }] }
        )
      )
    );

    if (clinicHoursChanged) {
      const doctors = await Doctor.find({
        user: { $exists: true, $ne: null },
      })
        .select("user")
        .lean();

      await Promise.all(
        doctors.flatMap((doctor) =>
          doctor.user
            ? [
                notifyUser(String(doctor.user), {
                  category: "schedule",
                  titleKey: "Notification: Clinic hours updated",
                  bodyKey:
                    "Notification body: The clinic updated its working hours. Review the marked days on your Working Hours page.",
                  href: "/doctor/working-hours",
                }),
              ]
            : []
        )
      );
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const appointments = await Appointment.find({
      date: { $gte: today },
      status: { $in: ["pending", "confirmed"] },
    })
      .select("_id doctor date time clinicHoursConflict")
      .lean();

    const clinicByDay = new Map(week.map((day) => [day.day, day]));

    const doctorIds = [
      ...new Set(
        appointments.map((appointment) => String(appointment.doctor))
      ),
    ];

    const doctors = await Doctor.find({ _id: { $in: doctorIds } })
      .select("_id schedule")
      .lean();

    const doctorById = new Map(
      doctors.map((doctor) => [
        String(doctor._id),
        normalizeWeek(doctor.schedule),
      ])
    );

    await Promise.all(
      appointments.map(async (appointment) => {
        const day = dayOfWeek(new Date(appointment.date));
        const clinicDay = clinicByDay.get(day);
        const doctorSchedule = doctorById.get(String(appointment.doctor));
        const doctorDay = doctorSchedule?.find((item) => item.day === day);

        if (!clinicDay || !doctorDay) return;

        const effectiveDay = intersectSchedules(
          [doctorDay],
          [clinicDay]
        )[0];

        const appointmentIsAvailable =
          !effectiveDay?.closed &&
          slotsForDay(effectiveDay).includes(appointment.time);

        if (appointmentIsAvailable) {
          if (appointment.clinicHoursConflict) {
            await Appointment.updateOne(
              { _id: appointment._id, clinicHoursConflict: true },
              { $set: { clinicHoursConflict: false } }
            );
          }
          return;
        }

        if (appointment.clinicHoursConflict) return;

        const updated = await Appointment.updateOne(
          {
            _id: appointment._id,
            clinicHoursConflict: { $ne: true },
          },
          { $set: { clinicHoursConflict: true } }
        );

        if (updated.modifiedCount === 0) return;

        await notifyAppointmentParties(
          String(appointment._id),
          {
            category: "appointment",
            titleKey:
              "Notification: Appointment affected by clinic hours change",
            bodyKey:
              "Notification body: Your appointment no longer fits the doctor and clinic working hours. Please choose another time or contact the clinic.",
            href: "/appointments",
          },
          {
            category: "appointment",
            titleKey:
              "Notification: Appointment affected by clinic hours change",
            bodyKey:
              "Notification body: An appointment on your schedule no longer fits the doctor and clinic working hours.",
            href: "/doctor/appointments",
          }
        );

        await notifyAdmins({
          category: "appointment",
          titleKey:
            "Notification: Appointment affected by clinic hours change",
          bodyKey:
            "Notification body: A future appointment needs review after the clinic hours changed.",
          href: "/admin/appointments",
          context: `${new Date(appointment.date).toISOString().slice(0, 10)} · ${appointment.time}`,
        });
      })
    );
  } catch (error) {
    console.error("Update clinic hours failed:", error);
    return {
      error: "Could not save clinic hours or process affected appointments.",
    };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/doctors");
  revalidatePath("/admin/appointments");
  revalidatePath("/appointments");
  revalidatePath("/doctor/appointments");
  revalidatePath("/doctor/working-hours");

  return { success: true };
}