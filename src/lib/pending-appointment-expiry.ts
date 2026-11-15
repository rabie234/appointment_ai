import connectDB from "@/lib/mongodb";
import { parseCalendarDate } from "@/lib/date-validation";
import { isPastClinicSlot, CLINIC_TIME_ZONE } from "@/lib/slots-server";
import { formatTime12h } from "@/lib/time-format";
import Appointment from "@/models/Appointment";
import Doctor from "@/models/Doctor";
import Notification from "@/models/Notification";
import User from "@/models/User";

export const PENDING_APPOINTMENT_EXPIRED_REASON =
  "Not confirmed before appointment time";

const MAX_APPOINTMENTS_PER_RUN = 25;

function clinicDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

/** Cancel pending requests whose scheduled start has passed in Beirut time. */
export async function expirePendingAppointments(now = new Date()) {
  await connectDB();

  const today = parseCalendarDate(clinicDateKey(now));
  if (!today) throw new Error("Could not determine today's clinic date.");

  const candidates = await Appointment.find({
    $or: [
      { status: "pending", date: { $lte: today } },
      {
        status: "cancelled",
        cancellationReason: PENDING_APPOINTMENT_EXPIRED_REASON,
        expiryNotificationSentAt: { $exists: false },
      },
    ],
  })
    .select("_id patient doctor date time status cancellationReason")
    .sort({ date: 1, time: 1 })
    .limit(MAX_APPOINTMENTS_PER_RUN)
    .lean();

  const due = candidates.filter(
    (appointment) =>
      appointment.status === "cancelled" ||
      isPastClinicSlot(
        appointment.date.toISOString().slice(0, 10),
        appointment.time,
        now,
      ),
  );

  if (!due.length) {
    return { checked: candidates.length, cancelled: 0, notified: 0 };
  }

  const admins = await User.find({ role: "admin" }).select("_id").lean();
  let cancelled = 0;
  let notified = 0;

  for (const candidate of due) {
    let appointment = candidate;

    if (candidate.status === "pending") {
      const expired = await Appointment.findOneAndUpdate(
        {
          _id: candidate._id,
          status: "pending",
          date: candidate.date,
          time: candidate.time,
        },
        {
          $set: {
            status: "cancelled",
            cancellationReason: PENDING_APPOINTMENT_EXPIRED_REASON,
          },
        },
        { new: false },
      )
        .select("_id patient doctor date time status cancellationReason")
        .lean();

      if (!expired) continue;
      appointment = expired;
      cancelled++;
    }

    const [patient, doctor] = await Promise.all([
      User.findById(appointment.patient).select("name").lean(),
      Doctor.findById(appointment.doctor).select("name").lean(),
    ]);
    const appointmentDate = appointment.date.toISOString().slice(0, 10);
    const appointmentTime = formatTime12h(appointment.time);
    const doctorContext = [
      doctor?.name,
      appointmentDate,
      appointmentTime,
    ]
      .filter(Boolean)
      .join(" · ");
    const adminContext = [
      patient?.name,
      doctor?.name,
      appointmentDate,
      appointmentTime,
    ]
      .filter(Boolean)
      .join(" · ");

    const appointmentId = String(appointment._id);
    const notifications = [
      {
        recipient: String(appointment.patient),
        titleKey: "Notification: Appointment request expired",
        bodyKey:
          "Notification body: Your appointment request was cancelled because the clinic did not confirm it before its scheduled time. You can book a new appointment.",
        href: "/appointments",
        context: doctorContext,
      },
      ...admins.map((admin) => ({
        recipient: String(admin._id),
        titleKey: "Notification: Pending appointment automatically cancelled",
        bodyKey:
          "Notification body: A pending appointment was automatically cancelled because it was not confirmed before its scheduled time.",
        href: "/admin/appointments",
        context: adminContext,
      })),
    ];

    // Stable keys let the next cron run retry safely after a partial failure.
    await Promise.all(
      notifications.map((notification) => {
        const eventKey = `pending-expired:${appointmentId}:${notification.recipient}`;
        return Notification.updateOne(
          { eventKey },
          {
            $setOnInsert: {
              ...notification,
              category: "appointment",
              eventKey,
            },
          },
          { upsert: true },
        );
      }),
    );

    const notificationState = await Appointment.updateOne(
      {
        _id: appointment._id,
        status: "cancelled",
        cancellationReason: PENDING_APPOINTMENT_EXPIRED_REASON,
        expiryNotificationSentAt: { $exists: false },
      },
      { $set: { expiryNotificationSentAt: new Date() } },
    );
    if (notificationState.modifiedCount > 0) notified++;
  }

  return { checked: candidates.length, cancelled, notified };
}
