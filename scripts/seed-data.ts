/**
 * Seeds a realistic clinic dataset so the AI assistant has something to
 * recommend from: many specialties, doctors across all of them (each with a
 * working schedule so they are actually bookable), and patient accounts.
 *
 *   npm run seed:data              # add/refresh seeded records
 *   RESET=1 npm run seed:data      # wipe seeded doctors/specialties/patients first
 *
 * Idempotent: doctors and specialties are upserted by a stable key (email /
 * name), and seeded patients are upserted by email. Re-running updates in place.
 * RESET only removes records this seeder owns (seeded patients carry a marker),
 * so it never touches the admin account or real sign-ups.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User';
import Doctor from '../src/models/Doctor';
import Specialty from '../src/models/Specialty';
import { DAYS, type DayHours } from '../src/lib/schedule';

// ── Schedule helpers ────────────────────────────────────────────────────────

type DayName = (typeof DAYS)[number];

/** Build a week: `days` are open with the given hours, everything else closed. */
function week(days: DayName[], open: string, close: string): DayHours[] {
  const set = new Set<string>(days);
  return DAYS.map((day) => ({
    day,
    open,
    close,
    closed: !set.has(day),
  }));
}

const WEEKDAYS: DayName[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// A few schedule "shapes" so availability varies doctor to doctor.
const SCHEDULES = {
  fullWeek: week(WEEKDAYS, '09:00', '17:00'),
  mornings: week(WEEKDAYS, '08:00', '12:30'),
  afternoons: week(WEEKDAYS, '13:00', '18:00'),
  mwf: week(['Monday', 'Wednesday', 'Friday'], '09:00', '16:00'),
  tuThu: week(['Tuesday', 'Thursday'], '10:00', '18:00'),
  withSaturday: week(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'], '09:00', '15:00'),
};

// ── Data ────────────────────────────────────────────────────────────────────

const SPECIALTIES: { name: string; description: string }[] = [
  { name: 'Cardiology', description: 'Heart and cardiovascular conditions — chest pain, blood pressure, palpitations.' },
  { name: 'Dermatology', description: 'Skin, hair, and nails — rashes, acne, moles, eczema.' },
  { name: 'Neurology', description: 'Brain and nervous system — headaches, migraines, dizziness, numbness.' },
  { name: 'Pediatrics', description: 'Medical care for infants, children, and adolescents.' },
  { name: 'Orthopedics', description: 'Bones, joints, and muscles — fractures, back pain, sports injuries.' },
  { name: 'Gastroenterology', description: 'Digestive system — stomach pain, reflux, bowel issues.' },
  { name: 'Psychiatry', description: 'Mental health — anxiety, depression, sleep and mood concerns.' },
  { name: 'Ophthalmology', description: 'Eye care — vision problems, eye pain, redness, dryness.' },
  { name: 'ENT (Otolaryngology)', description: 'Ear, nose, and throat — sinusitis, sore throat, hearing issues.' },
  { name: 'General Medicine', description: 'Primary care and general health concerns — fever, fatigue, check-ups.' },
];

type DoctorSeed = {
  name: string;
  specialty: string;
  experienceYears: number;
  rating: number;
  reviews: number;
  successRate: number;
  totalPatients: number;
  schedule: DayHours[];
  availability?: 'available' | 'on-leave';
};

// Two+ doctors per specialty, with varied schedules so availability differs.
const DOCTORS: DoctorSeed[] = [
  // Cardiology
  d('Dr. Sarah Johnson', 'Cardiology', 12, 4.9, 214, 98, 5200, SCHEDULES.fullWeek),
  d('Dr. Omar Haddad', 'Cardiology', 8, 4.7, 96, 95, 2100, SCHEDULES.mornings),
  // Dermatology
  d('Dr. Emily Smith', 'Dermatology', 10, 5.0, 260, 97, 4300, SCHEDULES.tuThu),
  d('Dr. Laila Karam', 'Dermatology', 6, 4.6, 71, 93, 1500, SCHEDULES.afternoons),
  // Neurology
  d('Dr. Michael Chen', 'Neurology', 15, 4.8, 132, 96, 3800, SCHEDULES.mwf),
  d('Dr. Nadia Rahman', 'Neurology', 9, 4.7, 88, 94, 2400, SCHEDULES.fullWeek),
  // Pediatrics
  d('Dr. David Williams', 'Pediatrics', 11, 4.7, 178, 97, 6100, SCHEDULES.withSaturday),
  d('Dr. Hana Yusuf', 'Pediatrics', 7, 4.9, 143, 98, 3300, SCHEDULES.mornings),
  // Orthopedics
  d('Dr. James Miller', 'Orthopedics', 14, 4.6, 119, 92, 2900, SCHEDULES.fullWeek),
  d('Dr. Sami Nasser', 'Orthopedics', 10, 4.8, 102, 95, 2600, SCHEDULES.afternoons),
  // Gastroenterology
  d('Dr. Rachel Green', 'Gastroenterology', 13, 4.7, 91, 94, 3100, SCHEDULES.mwf),
  d('Dr. Youssef Amir', 'Gastroenterology', 8, 4.5, 64, 91, 1700, SCHEDULES.tuThu),
  // Psychiatry
  d('Dr. Olivia Brown', 'Psychiatry', 12, 4.9, 156, 96, 2800, SCHEDULES.fullWeek),
  d('Dr. Karim Fadel', 'Psychiatry', 9, 4.6, 73, 93, 1900, SCHEDULES.afternoons),
  // Ophthalmology
  d('Dr. Sophia Davis', 'Ophthalmology', 11, 4.8, 128, 97, 4000, SCHEDULES.mornings),
  d('Dr. Amina Saleh', 'Ophthalmology', 6, 4.7, 59, 95, 1400, SCHEDULES.mwf),
  // ENT
  d('Dr. Daniel Wilson', 'ENT (Otolaryngology)', 10, 4.6, 84, 93, 2200, SCHEDULES.fullWeek),
  d('Dr. Rima Aziz', 'ENT (Otolaryngology)', 7, 4.8, 67, 96, 1600, SCHEDULES.withSaturday),
  // General Medicine
  d('Dr. Thomas Anderson', 'General Medicine', 16, 4.7, 201, 95, 7200, SCHEDULES.fullWeek),
  d('Dr. Farah Mansour', 'General Medicine', 9, 4.8, 154, 96, 3400, SCHEDULES.mornings, 'on-leave'),
];

function d(
  name: string,
  specialty: string,
  experienceYears: number,
  rating: number,
  reviews: number,
  successRate: number,
  totalPatients: number,
  schedule: DayHours[],
  availability: 'available' | 'on-leave' = 'available'
): DoctorSeed {
  return { name, specialty, experienceYears, rating, reviews, successRate, totalPatients, schedule, availability };
}

/** Stable e-mail from a doctor's name, e.g. "Dr. Sarah Johnson" → sarah.johnson@clinicai.test */
function doctorEmail(name: string): string {
  const clean = name.replace(/^Dr\.?\s*/i, '').trim().toLowerCase();
  return `${clean.replace(/\s+/g, '.')}@clinicai.test`;
}

const PATIENTS: { name: string; email: string }[] = [
  { name: 'Rabie Itwah', email: 'rabie@patient.test' },
  { name: 'Jane Smith', email: 'jane@patient.test' },
  { name: 'John Doe', email: 'john@patient.test' },
  { name: 'Alice Brown', email: 'alice@patient.test' },
  { name: 'Bob Wilson', email: 'bob@patient.test' },
  { name: 'Maria Garcia', email: 'maria@patient.test' },
];
const PATIENT_PASSWORD = 'patient123';

// ── Runner ──────────────────────────────────────────────────────────────────

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri.replace('localhost', '127.0.0.1'));

  if (process.env.RESET) {
    // Only remove records this seeder owns.
    const specialtyNames = SPECIALTIES.map((s) => s.name);
    await Doctor.deleteMany({ email: /@clinicai\.test$/ });
    await Specialty.deleteMany({ name: { $in: specialtyNames } });
    await User.deleteMany({ role: 'patient', email: /@patient\.test$/ });
    console.log('RESET: removed previously seeded doctors, specialties, and patients.');
  }

  // Specialties (upsert by name).
  for (const s of SPECIALTIES) {
    await Specialty.updateOne(
      { name: s.name },
      { $set: { name: s.name, description: s.description } },
      { upsert: true }
    );
  }
  console.log(`Specialties: ${SPECIALTIES.length} upserted.`);

  // Doctors (upsert by email).
  for (const doc of DOCTORS) {
    const email = doctorEmail(doc.name);
    await Doctor.updateOne(
      { email },
      {
        $set: {
          name: doc.name,
          specialty: doc.specialty,
          email,
          rating: doc.rating,
          reviews: doc.reviews,
          experience: `${doc.experienceYears} Years`,
          successRate: doc.successRate,
          totalPatients: doc.totalPatients,
          schedule: doc.schedule,
          status: 'active',
          availability: doc.availability,
        },
      },
      { upsert: true }
    );
  }
  console.log(`Doctors: ${DOCTORS.length} upserted across ${SPECIALTIES.length} specialties.`);

  // Patients (upsert by email). Password hashed by the User pre-save hook, so we
  // create/save documents rather than a bare updateOne when the user is new.
  let created = 0;
  for (const p of PATIENTS) {
    const email = p.email.toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) {
      existing.name = p.name;
      existing.role = 'patient';
      existing.password = PATIENT_PASSWORD; // re-hashed by the pre-save hook
      await existing.save();
    } else {
      await User.create({ name: p.name, email, password: PATIENT_PASSWORD, role: 'patient' });
      created++;
    }
  }
  console.log(`Patients: ${PATIENTS.length} upserted (${created} new). Password for all: "${PATIENT_PASSWORD}".`);

  await mongoose.disconnect();
  console.log('\nDone. Sign in as a patient (e.g. rabie@patient.test / patient123) and try the AI Chat.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
