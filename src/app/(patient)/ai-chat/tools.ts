import { Type, type FunctionDeclaration } from '@google/genai';
import connectDB from '@/lib/mongodb';
import { freeSlotsFor } from '@/lib/slots-server';
import Doctor from '@/models/Doctor';
import Specialty from '@/models/Specialty';

/**
 * The tools the AI assistant can call. All are READ-ONLY — they let the model
 * look up the clinic's real doctors, specialties, and live availability instead
 * of inventing them. Booking itself is never done here; the model proposes, the
 * patient confirms on the booking page.
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
      'to the patient. It records a structured suggestion the UI turns into a booking link. ' +
      'Only use a doctorId/date/time you obtained from the other tools.',
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

/**
 * Dispatch a model function call by name. Returns `{ result, suggestion? }` —
 * `suggestion` is set only by a successful propose_booking, and the caller
 * lifts it onto the final action response.
 */
export async function runTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ result: unknown; suggestion?: BookingSuggestion }> {
  switch (name) {
    case 'list_specialties':
      return { result: await listSpecialties() };
    case 'find_doctors':
      return { result: await findDoctors(args) };
    case 'get_available_slots':
      return { result: await getAvailableSlots(args) };
    case 'propose_booking': {
      const res = await proposeBooking(args);
      // Hand the confirmed suggestion up; still return the outcome to the model.
      return res.ok
        ? { result: { ok: true }, suggestion: res.suggestion }
        : { result: res };
    }
    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
