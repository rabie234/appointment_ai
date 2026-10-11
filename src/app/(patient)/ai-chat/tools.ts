import { Type, type FunctionDeclaration } from '@google/genai';
import { isValidObjectId } from 'mongoose';
import connectDB from '@/lib/mongodb';
import { freeSlotsFor, parseDay } from '@/lib/slots-server';
import { CONSULTATION_FEE } from './chat-core';
import Doctor from '@/models/Doctor';
import Specialty from '@/models/Specialty';
import Appointment from '@/models/Appointment';

/**
 * The tools the AI assistant can call. Most are READ-ONLY — they look up the
 * clinic's real doctors, specialties, and live availability. `confirm_booking`
 * is the one write: it creates an appointment, but only after the patient has
 * explicitly confirmed (the UI gates this behind a Confirm button).
 */

// ── Function declarations (what the model sees) ─────────────────────────────

export const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'list_specialties',
    description:
      'List the medical specialties this clinic actually offers. Call this FIRST when a ' +
      'patient describes a problem, so you route them to a specialty the clinic really has.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'find_doctors',
    description:
      'Find active doctors in a given specialty. Use the exact specialty name returned by ' +
      'list_specialties. Returns each doctor id, name, specialty, rating and experience.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        specialty: {
          type: Type.STRING,
          description: 'Specialty name, e.g. "Cardiology". Must match an offered specialty.',
        },
      },
      required: ['specialty'],
    },
  },
  {
    name: 'get_available_slots',
    description:
      "Get a doctor's real free appointment time slots for a specific date. Use the doctorId " +
      'from find_doctors. Date must be "YYYY-MM-DD". Returns 24h "HH:MM" times still open.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        doctorId: { type: Type.STRING, description: 'The doctor id from find_doctors.' },
        date: { type: Type.STRING, description: 'Target date in YYYY-MM-DD format.' },
      },
      required: ['doctorId', 'date'],
    },
  },
  {
    name: 'propose_booking',
    description:
      'Call this once you have settled on a specific doctor, date and free time to recommend ' +
      'to the patient. It records a structured suggestion the UI shows with a "Confirm booking" ' +
      'button. Do NOT book yet — wait for the patient to confirm. Only use a doctorId/date/time ' +
      'you obtained from the other tools.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        doctorId: { type: Type.STRING, description: 'The recommended doctor id.' },
        date: { type: Type.STRING, description: 'Recommended date, YYYY-MM-DD.' },
        time: { type: Type.STRING, description: 'Recommended free slot, 24h HH:MM.' },
      },
      required: ['doctorId', 'date', 'time'],
    },
  },
  {
    name: 'confirm_booking',
    description:
      'Actually create the appointment in the system. Call this ONLY after the patient has ' +
      'explicitly confirmed a specific doctor, date and time (e.g. they clicked Confirm or said ' +
      '"yes, book it"). If the slot is no longer free, this returns booked:false with a reason ' +
      'and a list of alternative free times — tell the patient that slot is unavailable and ' +
      'offer one of the alternatives.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        doctorId: { type: Type.STRING, description: 'The doctor id to book.' },
        date: { type: Type.STRING, description: 'Date to book, YYYY-MM-DD.' },
        time: { type: Type.STRING, description: 'Slot to book, 24h HH:MM.' },
        type: {
          type: Type.STRING,
          description: 'Visit type: "in-person" (default) or "video".',
        },
      },
      required: ['doctorId', 'date', 'time'],
    },
  },
];

// ── Tool implementations ────────────────────────────────────────────────────

export type BookingSuggestion = {
  doctorId: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
};

async function listSpecialties() {
  await connectDB();
  const [specialtyDocs, usedSpecialties] = await Promise.all([
    Specialty.find().select('name description').sort({ name: 1 }).lean(),
    Doctor.distinct('specialty', { status: 'active' }),
  ]);
  const names = Array.from(
    new Set([...specialtyDocs.map((s) => s.name), ...usedSpecialties])
  ).sort();
  return { specialties: names };
}

async function findDoctors(args: { specialty?: string }) {
  const specialty = String(args.specialty ?? '').trim();
  if (!specialty) return { error: 'specialty is required' };

  await connectDB();
  const docs = await Doctor.find({
    status: 'active',
    // Case-insensitive exact match so "cardiology" still matches "Cardiology".
    specialty: new RegExp(`^${escapeRegExp(specialty)}$`, 'i'),
  })
    .select('name specialty rating experience availability')
    .sort({ rating: -1 })
    .lean();

  return {
    doctors: docs.map((d) => ({
      doctorId: String(d._id),
      name: d.name,
      specialty: d.specialty,
      rating: d.rating ?? 0,
      experience: d.experience ?? '',
      availability: d.availability,
    })),
  };
}

async function getAvailableSlots(args: { doctorId?: string; date?: string }) {
  const doctorId = String(args.doctorId ?? '');
  const date = String(args.date ?? '');
  if (!doctorId || !date) return { error: 'doctorId and date are required' };

  const result = await freeSlotsFor(doctorId, date);
  if (result.error) return { error: result.error };
  return { date, slots: result.slots ?? [] };
}

/**
 * Validate the model's proposal against real data before we surface it. Returns
 * either a confirmed suggestion (attached to the action's response) or an error
 * the model should react to.
 */
async function proposeBooking(args: { doctorId?: string; date?: string; time?: string }) {
  const doctorId = String(args.doctorId ?? '');
  const date = String(args.date ?? '');
  const time = String(args.time ?? '');
  if (!doctorId || !date || !time) {
    return { ok: false, error: 'doctorId, date and time are required' };
  }

  await connectDB();
  const doctor = await Doctor.findById(doctorId).select('name specialty status').lean();
  if (!doctor || doctor.status !== 'active') {
    return { ok: false, error: 'That doctor is not available' };
  }

  const { slots, error } = await freeSlotsFor(doctorId, date);
  if (error) return { ok: false, error };
  if (!slots?.includes(time)) {
    return { ok: false, error: 'That time is not actually free — pick from get_available_slots.' };
  }

  const suggestion: BookingSuggestion = {
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
  type: 'in-person' | 'video';
};

/**
 * Create the appointment. Re-validates everything server-side and guards the
 * slot right before insert. On conflict (slot taken, or doctor not available
 * then) it returns booked:false with the reason and the remaining free times so
 * the assistant can offer an alternative instead of failing.
 */
async function confirmBooking(
  patientId: string,
  args: { doctorId?: string; date?: string; time?: string; type?: string }
) {
  const doctorId = String(args.doctorId ?? '');
  const date = String(args.date ?? '');
  const time = String(args.time ?? '');
  const type = String(args.type ?? 'in-person') === 'video' ? 'video' : 'in-person';

  if (!isValidObjectId(doctorId) || !date || !time) {
    return { booked: false, reason: 'doctorId, date and time are required' };
  }

  const day = parseDay(date);
  if (!day) return { booked: false, reason: 'Invalid date' };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (day < today) return { booked: false, reason: 'That date has already passed' };

  await connectDB();

  const doctor = await Doctor.findById(doctorId).select('name specialty status').lean();
  if (!doctor || doctor.status !== 'active') {
    return { booked: false, reason: 'That doctor is not available' };
  }

  // The source of truth for "is this slot bookable right now".
  const { slots, error } = await freeSlotsFor(doctorId, date);
  if (error) return { booked: false, reason: error };

  if (!slots?.includes(time)) {
    // Conflict — the slot is gone (or never existed). Offer what's still free.
    return {
      booked: false,
      reason: `${doctor.name} is not available on ${date} at ${time}.`,
      alternatives: slots ?? [],
    };
  }

  try {
    const appt = await Appointment.create({
      patient: patientId,
      doctor: doctorId,
      date: day,
      time,
      type,
      status: 'pending',
      price: CONSULTATION_FEE,
    });

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
    console.error('confirm_booking failed:', err);
    return { booked: false, reason: 'Could not create the appointment. Please try again.' };
  }
}

/**
 * Dispatch a model function call by name. Returns the tool result to feed back
 * to the model, plus (when applicable) a `suggestion` or a `confirmation` that
 * the caller lifts onto the stream so the UI can render the Book/Booked card.
 *
 * `patientId` is required by confirm_booking to own the created appointment; it
 * comes from the authenticated session, never from the model.
 */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  patientId: string
): Promise<{
  result: unknown;
  suggestion?: BookingSuggestion;
  confirmation?: BookingConfirmation;
}> {
  switch (name) {
    case 'list_specialties':
      return { result: await listSpecialties() };
    case 'find_doctors':
      return { result: await findDoctors(args) };
    case 'get_available_slots':
      return { result: await getAvailableSlots(args) };
    case 'propose_booking': {
      const res = await proposeBooking(args);
      return res.ok
        ? { result: { ok: true }, suggestion: res.suggestion }
        : { result: res };
    }
    case 'confirm_booking': {
      const res = await confirmBooking(patientId, args);
      return res.booked
        ? { result: { booked: true }, confirmation: res.confirmation }
        : { result: res };
    }
    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
