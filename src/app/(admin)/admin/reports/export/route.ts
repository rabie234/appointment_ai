import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Appointment from '@/models/Appointment';
import { resolveRange } from '../range';

export const dynamic = 'force-dynamic';

type PopulatedPatient = { name?: string; email?: string } | null;
type PopulatedDoctor = { name?: string; specialty?: string } | null;

/**
 * CSV of every appointment dated in the selected report range — the same slice
 * the reports page shows. Middleware guards /admin, but route handlers are
 * reachable directly, so the role is re-checked here.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }

  const range = resolveRange(req.nextUrl.searchParams.get('range') ?? undefined);

  await connectDB();
  const docs = await Appointment.find({ date: { $gte: range.start, $lt: range.end } })
    .populate<{ patient: PopulatedPatient }>('patient', 'name email')
    .populate<{ doctor: PopulatedDoctor }>('doctor', 'name specialty')
    .sort({ date: 1, time: 1 })
    .lean();

  const header = ['Date', 'Time', 'Patient', 'Patient email', 'Doctor', 'Specialty', 'Type', 'Status', 'Price', 'Booked at'];
  const rows = docs.map((a) => [
    new Date(a.date).toISOString().slice(0, 10),
    a.time,
    a.patient?.name ?? 'Unknown patient',
    a.patient?.email ?? '',
    a.doctor?.name ?? 'Unknown doctor',
    a.doctor?.specialty ?? '',
    a.type,
    a.status,
    a.price.toFixed(2),
    new Date(a.createdAt).toISOString(),
  ]);

  // BOM so Excel opens UTF-8 (e.g. Arabic names) correctly; CRLF per RFC 4180.
  const csv = '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="appointments-${range.key}-${today}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

function csvCell(value: string): string {
  // Names are user-supplied: neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
