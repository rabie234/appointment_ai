
import { Type, type FunctionDeclaration } from "@google/genai";
import { isValidObjectId, Types } from "mongoose";
import connectDB from "@/lib/mongodb";
import {
  CLINIC_TIME_ZONE,
  dayBounds,
  freeSlotsFor,
  isPastClinicSlot,
  parseDay,
} from "@/lib/slots-server";
import {
  availableSlots,
  intersectSchedules,
  normalizeWeek,
  type DayHours,
} from "@/lib/schedule";
import { getClinicHours } from "@/lib/clinic-hours";
import { CONSULTATION_FEE } from "./chat-core";
import Doctor from "@/models/Doctor";
import DoctorLeave from "@/models/DoctorLeave";
import Specialty from "@/models/Specialty";
import Appointment from "@/models/Appointment";
import { randomUUID } from "node:crypto";
import { searchKnowledge } from "@/lib/knowledge-server";
import {
  bookingIsAuthorized,
  createAppointmentWithPatientConflictGuard,
  findActiveAppointmentInSpecialty,
  findPatientTimeConflict,
  type ToolContext,
} from "@/lib/booking-policy";
import { notifyAdmins, notifyUser } from "@/lib/notification-service";

/**
 * The tools the AI assistant can call. Most are READ-ONLY — they look up the
 * clinic's real doctors, specialties, and live availability. `confirm_booking`
 * is deliberately absent from the model's declarations. The server invokes it
 * only after consuming a patient-owned saved proposal; sandbox calls are denied.
 */

// ── Function declarations (what the model sees) ─────────────────────────────

export const functionDeclarations: FunctionDeclaration[] = [
  {
    name: "search_clinic_knowledge",
    description:
      "Search approved clinic FAQs and documents for policies, location, insurance, preparation and general clinic information. Returns source IDs, titles and passages. Never use this for live appointment slots or doctor availability.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "The patient question or relevant search terms.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_specialties",
    description:
      "List the medical specialties this clinic actually offers. Call this FIRST when a " +
      "patient describes a problem, so you route them to a specialty the clinic really has.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "find_doctors",
    description:
      "Search active clinic doctors by specialty, doctor name, or both. " +
      "When a patient requests a specific doctor, search by name across all specialties, " +
      "without restricting the search to the recommended specialty. " +
      "Return each doctor id, name, actual specialty, rating, and experience. " +
      "If activeAppointmentInRequestedSpecialty is present, tell the patient they already have an active appointment in that specialty and do not suggest another booking there.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        specialty: {
          type: Type.STRING,
          description:
            "Optional specialty filter. Use the exact specialty name returned by list_specialties.",
        },
        name: {
          type: Type.STRING,
          description:
            'Optional doctor name or partial name, such as "Karim". Search across all specialties when the patient requests a specific doctor.',
        },
      },
    },
  },
  {
    name: "get_available_slots",
    description:
      "Get a doctor's real free appointment time slots for a specific date. Use the doctorId " +
      'from find_doctors. Date must be "YYYY-MM-DD". Returns 24h "HH:MM" times still open.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        doctorId: {
          type: Type.STRING,
          description: "The doctor id from find_doctors.",
        },
        date: {
          type: Type.STRING,
          description: "Target date in YYYY-MM-DD format.",
        },
      },
      required: ["doctorId", "date"],
    },
  },
  {
    name: "find_nearest_available_appointment",
    description:
      "Use when a patient asks for the nearest or earliest appointment in a specialty, or says any doctor is fine. Search all active doctors in that specialty and return the actual earliest bookable date and time. This also prepares a Confirm booking card but never books without the patient confirming. Do not ask the patient to choose a doctor first.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        specialty: {
          type: Type.STRING,
          description: "The exact specialty name from the clinic directory.",
        },
      },
      required: ["specialty"],
    },
  },
  {
    name: "propose_booking",
    description:
      "Call this once you have settled on a specific doctor, date and free time to recommend " +
      'to the patient. It records a structured suggestion the UI shows with a "Confirm booking" ' +
      "button. Do NOT book yet — wait for the patient to confirm. Only use a doctorId/date/time " +
      "you obtained from the other tools. If the result contains existingAppointment, explain " +
      "that booking another appointment in that specialty is blocked until the current one ends.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        doctorId: {
          type: Type.STRING,
          description: "The recommended doctor id.",
        },
        date: {
          type: Type.STRING,
          description: "Recommended date, YYYY-MM-DD.",
        },
        time: {
          type: Type.STRING,
          description: "Recommended free slot, 24h HH:MM.",
        },
      },
      required: ["doctorId", "date", "time"],
    },
  },

  {
    name: "find_my_appointments",
    description:
      "Retrieve appointments belonging to the signed-in patient. " +
      "Use upcoming by default. Patients can request specific statuses or history.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        doctorName: {
          type: Type.STRING,
          description: "Optional doctor name or partial name.",
        },
        status: {
          type: Type.STRING,
          enum: [
            "upcoming",
            "confirmed",
            "pending",
            "cancelled",
            "history",
            "all",
          ],
          description:
            "Use upcoming by default. Choose a specific filter when requested.",
        },
      },
    },
  },
  {
    name: "propose_cancellation",
    description:
      "Prepare a cancellation suggestion for a specific appointment returned by find_my_appointments. Never cancel the appointment.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        appointmentId: {
          type: Type.STRING,
          description:
            "The exact appointment ID returned by find_my_appointments.",
        },
      },
      required: ["appointmentId"],
    },
  },
];

// ── Tool implementations ────────────────────────────────────────────────────

export type BookingSuggestion = {
  proposalId: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
};

export type CancellationSuggestion = {
  appointmentId: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  type: "in-person" | "video";
};

async function listSpecialties() {
  await connectDB();

  const [specialtyDocs, usedSpecialties] = await Promise.all([
    Specialty.find().select("name description").sort({ name: 1 }).lean(),
    Doctor.distinct("specialty", { status: "active" }),
  ]);

  const names = Array.from(
    new Set([...specialtyDocs.map((s) => s.name), ...usedSpecialties]),
  ).sort();

  return { specialties: names };
}

async function findDoctors(
  args: { specialty?: string; name?: string },
  patientId: string,
) {
  const specialty = String(args.specialty ?? "").trim();
  const name = String(args.name ?? "").trim();

  if (!specialty && !name) {
    return { error: "Provide a doctor name, a specialty, or both." };
  }

  await connectDB();

  const filter: Record<string, unknown> = { status: "active" };

  if (specialty)
    filter.specialty = new RegExp(`^${escapeRegExp(specialty)}$`, "i");

  if (name) filter.name = new RegExp(escapeRegExp(name), "i");

  const docs = await Doctor.find(filter)
    .select("name specialty rating experience")
    .sort({ rating: -1 })
    .limit(20)
    .lean();

  const activeAppointmentInRequestedSpecialty = specialty
    ? await findActiveAppointmentInSpecialty(patientId, specialty)
    : null;

  return {
    doctors: docs.map((d) => ({
      doctorId: String(d._id),
      name: d.name,
      specialty: d.specialty,
      rating: d.rating ?? 0,
      experience: d.experience ?? "",
    })),
    ...(activeAppointmentInRequestedSpecialty
      ? { activeAppointmentInRequestedSpecialty }
      : {}),
  };
}

async function getAvailableSlots(args: { doctorId?: string; date?: string }) {
  const doctorId = String(args.doctorId ?? "");
  const date = String(args.date ?? "");

  if (!doctorId || !date) {
    return { error: "doctorId and date are required" };
  }

  const result = await freeSlotsFor(doctorId, date);

  if (result.error) return { error: result.error };

  return { date, slots: result.slots ?? [] };
}

/** Find the earliest live slot across every active doctor in a specialty. */
async function findNearestAvailableAppointment(
  args: { specialty?: string },
  patientId: string,
) {
  const specialty = String(args.specialty ?? "").trim();
  if (!specialty) return { result: { found: false, error: "Specialty is required." } };

  const activeAppointment = await findActiveAppointmentInSpecialty(
    patientId,
    specialty,
  );
  if (activeAppointment) {
    return {
      result: { found: false, existingAppointment: activeAppointment },
    };
  }

  await connectDB();
  const doctors = await Doctor.find({
    status: "active",
    specialty: new RegExp(`^${escapeRegExp(specialty)}$`, "i"),
  })
    .select("name specialty schedule")
    .lean();

  if (doctors.length === 0) {
    return {
      result: {
        found: false,
        error: `No active doctors were found in ${specialty}.`,
      },
    };
  }

  const clinicSchedule = await getClinicHours();
  const schedules = new Map<string, DayHours[]>();
  for (const doctor of doctors) {
    schedules.set(
      String(doctor._id),
      intersectSchedules(normalizeWeek(doctor.schedule), clinicSchedule),
    );
  }

  const today = clinicDateString(new Date());
  const start = parseDay(today);
  if (!start) {
    return { result: { found: false, error: "Could not determine today's date." } };
  }

  // Search the next year in one batch, then rank matching open slots in memory.
  const searchEnd = new Date(start);
  searchEnd.setUTCDate(searchEnd.getUTCDate() + 365);
  const { start: rangeStart } = dayBounds(start);
  const rangeEnd = searchEnd;
  const doctorIds = doctors.map((doctor) => doctor._id);
  const [appointments, leaves] = await Promise.all([
    Appointment.find({
      doctor: { $in: doctorIds },
      date: { $gte: rangeStart, $lt: rangeEnd },
      status: { $ne: "cancelled" },
    })
      .select("doctor date time")
      .lean(),
    DoctorLeave.find({
      doctor: { $in: doctorIds },
      startDate: { $lt: rangeEnd },
      endDate: { $gt: rangeStart },
      $or: [
        { status: "approved" },
        // Older Admin-created leaves may not have a status field.
        { status: { $exists: false } },
      ],
    })
      .select("doctor startDate endDate")
      .lean(),
  ]);

  const bookedByDoctorAndDay = new Map<string, Set<string>>();
  for (const appointment of appointments) {
    const key = `${String(appointment.doctor)}:${new Date(appointment.date).toISOString().slice(0, 10)}`;
    const times = bookedByDoctorAndDay.get(key) ?? new Set<string>();
    times.add(appointment.time);
    bookedByDoctorAndDay.set(key, times);
  }

  const leavesByDoctor = new Map<
    string,
    Array<{ startDate: Date; endDate: Date }>
  >();
  for (const leave of leaves) {
    const doctorId = String(leave.doctor);
    const doctorLeaves = leavesByDoctor.get(doctorId) ?? [];
    doctorLeaves.push({ startDate: leave.startDate, endDate: leave.endDate });
    leavesByDoctor.set(doctorId, doctorLeaves);
  }

  for (let offset = 0; offset < 365; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + offset);
    const dateString = date.toISOString().slice(0, 10);
    const { start: dayStart, end: dayEnd } = dayBounds(date);
    const candidates: Array<{
      doctorId: string;
      doctorName: string;
      specialty: string;
      date: string;
      time: string;
    }> = [];

    for (const doctor of doctors) {
      const doctorId = String(doctor._id);
      const schedule = schedules.get(doctorId) ?? [];
      const isOnLeave = (leavesByDoctor.get(doctorId) ?? []).some(
        (leave) => leave.startDate < dayEnd && leave.endDate > dayStart,
      );
      if (isOnLeave) continue;

      const key = `${doctorId}:${dateString}`;
      const slots = availableSlots(
        schedule,
        date,
        bookedByDoctorAndDay.get(key) ?? new Set<string>(),
      ).filter((time) => !isPastClinicSlot(dateString, time));

      for (const time of slots) {
        candidates.push({
          doctorId,
          doctorName: doctor.name,
          specialty: doctor.specialty,
          date: dateString,
          time,
        });
      }
    }

    const candidateTimes = Array.from(
      new Set(candidates.map((candidate) => candidate.time)),
    ).sort();

    for (const time of candidateTimes) {
      // A patient cannot hold overlapping appointments with different doctors.
      if (await findPatientTimeConflict(patientId, date, time)) continue;

      const nearest = candidates
        .filter((candidate) => candidate.time === time)
        .sort((left, right) => left.doctorName.localeCompare(right.doctorName))[0];
      if (!nearest) continue;

      const suggestion: BookingSuggestion = {
        proposalId: randomUUID(),
        ...nearest,
      };
      return {
        result: { found: true, appointment: nearest },
        suggestion,
      };
    }
  }

  return {
    result: {
      found: false,
      error: `No bookable appointments were found in ${specialty} during the next 12 months.`,
    },
  };
}

function clinicDateString(now: Date): string {
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

type AppointmentFilter =
  | "upcoming"
  | "confirmed"
  | "pending"
  | "cancelled"
  | "history"
  | "all";

async function findMyAppointments(
  patientId: string,
  args: {
    doctorName?: string;
    status?: AppointmentFilter;
  }
) {
  const doctorName = String(args.doctorName ?? "").trim();
  const status = args.status ?? "upcoming";

  await connectDB();

  let doctorIds: Types.ObjectId[] | undefined;

  if (doctorName) {
    const doctors = await Doctor.find({
      name: { $regex: escapeRegExp(doctorName), $options: "i" },
    })
      .select("_id")
      .lean();

    if (doctors.length === 0) {
      return { doctorNotFound: true, requestedName: doctorName };
    }

    doctorIds = doctors.map((doctor) => doctor._id);
  }

  const statusFilters: Record<AppointmentFilter, string[]> = {
    upcoming: ["pending", "confirmed", "in-progress"],
    confirmed: ["confirmed"],
    pending: ["pending"],
    cancelled: ["cancelled"],
    history: ["completed", "missed"],
    all: [
      "pending",
      "confirmed",
      "in-progress",
      "completed",
      "cancelled",
      "missed",
    ],
  };

  const appointments = await Appointment.find({
    patient: patientId,
    ...(doctorIds ? { doctor: { $in: doctorIds } } : {}),
    status: { $in: statusFilters[status] },
  })
    .populate("doctor", "name specialty")
    .sort({
      date:
        status === "all" || status === "history" || status === "cancelled"
          ? -1
          : 1,
      time: 1,
    })
    .lean();

  return {
    requestedStatus: status,
    appointments: appointments.flatMap((appointment) => {
      const doctor = appointment.doctor as unknown as {
        name?: string;
        specialty?: string;
      } | null;

      if (!doctor) return [];

      return [{
        appointmentId: String(appointment._id),
        doctorName: doctor.name ?? "Unknown doctor",
        specialty: doctor.specialty ?? "",
        date: new Date(appointment.date).toISOString().slice(0, 10),
        time: appointment.time,
        type: appointment.type,
        status: appointment.status,
        cancellationReason: appointment.cancellationReason ?? "",
      }];
    }),
  };
}

/**
 * Validate that an appointment belongs to the patient and can still be
 * cancelled, and return it as a suggestion card. This never cancels — the
 * patient does that from the card, via /api/ai-chat/cancel-appointment.
 */
async function proposeCancellation(
  patientId: string,
  args: { appointmentId: string },
) {
  const appointmentId = String(args.appointmentId ?? "");

  if (!isValidObjectId(appointmentId)) {
    return { error: "Invalid appointment ID." };
  }

  await connectDB();

  const appointment = await Appointment.findOne({
    _id: appointmentId,
    patient: patientId,
    status: { $in: ["pending", "confirmed"] },
    date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
  })
    .populate("doctor", "name specialty")
    .lean();

  if (!appointment || !appointment.doctor) {
    return { error: "This appointment cannot be cancelled or was not found." };
  }

  const doctor = appointment.doctor as unknown as {
    name: string;
    specialty: string;
  };

  return {
    appointmentId: String(appointment._id),
    doctorName: doctor.name,
    specialty: doctor.specialty,
    date: new Date(appointment.date).toISOString().slice(0, 10),
    time: appointment.time,
    type: appointment.type,
  } satisfies CancellationSuggestion;
}

/**
 * Validate the model's proposal against real data before we surface it.
 * Returns either a confirmed suggestion or an error.
 */
async function proposeBooking(
  args: {
    doctorId?: string;
    date?: string;
    time?: string;
  },
  patientId: string,
) {
  const doctorId = String(args.doctorId ?? "");
  const date = String(args.date ?? "");
  const time = String(args.time ?? "");

  if (!doctorId || !date || !time) {
    return { ok: false, error: "doctorId, date and time are required" };
  }

  if (!isValidObjectId(doctorId)) {
    return { ok: false, error: "Invalid doctor id" };
  }

  const parsedDate = parseDay(date);

  if (!parsedDate) {
    return { ok: false, error: "Invalid date" };
  }

  await connectDB();

  const doctor = await Doctor.findById(doctorId)
    .select("name specialty status")
    .lean();

  if (!doctor || doctor.status !== "active") {
    return { ok: false, error: "That doctor is not available" };
  }

  // NEW: Do not even suggest a time that overlaps an active patient booking.
  const timeConflict = await findPatientTimeConflict(
    patientId,
    parsedDate,
    time
  );

  if (timeConflict) {
    return {
      ok: false,
      error:
        `You already have an active appointment with Dr. ${timeConflict.doctorName} ` +
        `on ${timeConflict.date} at ${timeConflict.time}. Choose a different time.`,
    };
  }

  const existingAppointment = await findActiveAppointmentInSpecialty(
    patientId,
    doctor.specialty ?? "",
  );

  if (existingAppointment) {
    return {
      ok: false,
      error:
        "You already have an active appointment in this specialty. Finish or cancel it before booking another.",
      existingAppointment,
    };
  }

  const { slots, error } = await freeSlotsFor(doctorId, date);

  if (error) return { ok: false, error };

  if (!slots?.includes(time)) {
    return {
      ok: false,
      error: "That time is not actually free — pick from get_available_slots.",
    };
  }

  const suggestion: BookingSuggestion = {
    proposalId: randomUUID(),
    doctorId,
    doctorName: doctor.name,
    specialty: doctor.specialty,
    date,
    time,
  };

  return { ok: true, suggestion };
}

export type BookingConfirmation = {
  appointmentId: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  type: "in-person" | "video";
};

/**
 * Create the appointment. Re-validates everything server-side.
 * The patient-wide overlap check is repeated at final confirmation.
 */
async function confirmBooking(
  patientId: string,
  args: { doctorId?: string; date?: string; time?: string; type?: string },
) {
  const doctorId = String(args.doctorId ?? "");
  const date = String(args.date ?? "");
  const time = String(args.time ?? "");

  const type =
    String(args.type ?? "in-person") === "video" ? "video" : "in-person";

  if (!isValidObjectId(doctorId) || !date || !time) {
    return { booked: false, reason: "doctorId, date and time are required" };
  }

  const day = parseDay(date);

  if (!day) {
    return { booked: false, reason: "Invalid date" };
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (day < today) {
    return { booked: false, reason: "That date has already passed" };
  }

  await connectDB();

  const doctor = await Doctor.findById(doctorId)
    .select("name specialty status")
    .lean();

  if (!doctor || doctor.status !== "active") {
    return { booked: false, reason: "That doctor is not available" };
  }

  // NEW: Final patient-wide conflict check before the booking is created.
  const timeConflict = await findPatientTimeConflict(
    patientId,
    day,
    time
  );

  if (timeConflict) {
    return {
      booked: false,
      reason:
        `You already have an active appointment with Dr. ${timeConflict.doctorName} ` +
        `on ${timeConflict.date} at ${timeConflict.time}. Choose a different time.`,
    };
  }

  const existingAppointment = await findActiveAppointmentInSpecialty(
    patientId,
    doctor.specialty ?? "",
  );

  if (existingAppointment) {
    return {
      booked: false,
      reason:
        "You already have an active appointment in this specialty. Finish or cancel it before booking another.",
      existingAppointment,
    };
  }

  // The source of truth for "is this slot bookable right now".
  const { slots, error } = await freeSlotsFor(doctorId, date);

  if (error) {
    return { booked: false, reason: error };
  }

  if (!slots?.includes(time)) {
    return {
      booked: false,
      reason: `${doctor.name} is not available on ${date} at ${time}.`,
      alternatives: slots ?? [],
    };
  }

  try {
    const guarded = await createAppointmentWithPatientConflictGuard({
      patient: patientId,
      doctor: doctorId,
      date: day,
      time,
      type,
      status: "pending",
      price: CONSULTATION_FEE,
    });

    if (guarded.specialtyConflict) {
      return {
        booked: false,
        reason:
          `You already have an active ${guarded.specialtyConflict.specialty} appointment with Dr. ${guarded.specialtyConflict.doctorName} ` +
          `on ${guarded.specialtyConflict.date} at ${guarded.specialtyConflict.time}. Finish or cancel it before booking another in this specialty.`,
        existingAppointment: guarded.specialtyConflict,
      };
    }

    if (guarded.conflict) {
      return {
        booked: false,
        reason:
          `You already have an active appointment with Dr. ${guarded.conflict.doctorName} ` +
          `on ${guarded.conflict.date} at ${guarded.conflict.time}. Choose a different time.`,
      };
    }

    const appt = guarded.appointment;

    await Promise.all([
      notifyUser(patientId, {
        category: "appointment",
        titleKey: "Notification: Appointment request received",
        bodyKey: "Notification body: The clinic received your appointment request.",
        href: "/appointments",
        context: date + " · " + time,
      }),
      notifyAdmins({
        category: "appointment",
        titleKey: "Notification: New appointment request",
        bodyKey: "Notification body: A patient submitted an appointment request that needs confirmation.",
        href: "/admin/appointments",
        context: date + " · " + time,
      }),
    ]);

    const confirmation: BookingConfirmation = {
      appointmentId: String(appt._id),
      doctorName: doctor.name,
      specialty: doctor.specialty,
      date,
      time,
      type,
    };

    return { booked: true, confirmation };
  } catch (err) {
    console.error("confirm_booking failed:", err);

    return {
      booked: false,
      reason: "Could not create the appointment. Please try again.",
    };
  }
}

/**
 * Dispatch a model function call by name. Returns the tool result to feed back
 * to the model, plus (when applicable) a booking `suggestion`, a booking
 * `confirmation`, or a `cancellationSuggestion` that the caller lifts onto
 * the stream so the UI can render the matching card.
 *
 * `patientId` comes from the authenticated session, never from the model.
 */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  patientId: string,
  context: ToolContext = { mode: "patient" },
): Promise<{
  result: unknown;
  suggestion?: BookingSuggestion;
  confirmation?: BookingConfirmation;
  cancellationSuggestion?: CancellationSuggestion;
}> {
  switch (name) {
    case "search_clinic_knowledge": {
      const query = String(args.query ?? "")
        .trim()
        .slice(0, 2000);

      const knowledgeMode =
        context.mode === "test"
          ? (context.knowledgeMode ?? "draft")
          : "published";

      return {
        result: { sources: await searchKnowledge(query, knowledgeMode) },
      };
    }

    case "list_specialties":
      return { result: await listSpecialties() };

    case "find_doctors":
      return { result: await findDoctors(args, patientId) };

    case "get_available_slots":
      return { result: await getAvailableSlots(args) };
    case "find_nearest_available_appointment":
      return findNearestAvailableAppointment(args, patientId);
    case "propose_booking": {
      const res = await proposeBooking(args, patientId);

      return res.ok
        ? { result: { ok: true }, suggestion: res.suggestion }
        : { result: res };
    }

    case "confirm_booking": {
      if (!bookingIsAuthorized(context, args)) {
        return {
          result: {
            booked: false,
            reason:
              "Booking requires the patient to confirm the current saved proposal. Sandbox booking is disabled.",
          },
        };
      }

      const res = await confirmBooking(patientId, args);

      return res.booked
        ? { result: { booked: true }, confirmation: res.confirmation }
        : { result: res };
    }

    case "find_my_appointments": {
      const allowedStatuses: AppointmentFilter[] = [
        "upcoming",
        "confirmed",
        "pending",
        "cancelled",
        "history",
        "all",
      ];

      const requestedStatus = String(args.status ?? "upcoming");

      const status: AppointmentFilter =
        allowedStatuses.includes(requestedStatus as AppointmentFilter)
          ? (requestedStatus as AppointmentFilter)
          : "upcoming";

      return {
        result: await findMyAppointments(patientId, {
          doctorName: String(args.doctorName ?? ""),
          status,
        }),
      };
    }

    case "propose_cancellation": {
      const res = await proposeCancellation(patientId, {
        appointmentId: String(args.appointmentId ?? ""),
      });

      if ("error" in res) return { result: res };

      return {
        result: { message: "Cancellation suggestion prepared." },
        cancellationSuggestion: res,
      };
    }

    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
