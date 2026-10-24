
import { NextRequest, NextResponse } from 'next/server';
import { isValidObjectId } from 'mongoose';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Appointment from '@/models/Appointment';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'patient') {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const appointmentId = String(body?.appointmentId ?? '');

    if (!isValidObjectId(appointmentId)) {
      return NextResponse.json(
        { error: 'Invalid appointment ID.' },
        { status: 400 }
      );
    }

    await connectDB();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointment = await Appointment.findOneAndUpdate(
      {
        _id: appointmentId,
        patient: session.user.id,
        status: { $in: ['pending', 'confirmed'] },
        date: { $gte: today },
      },
      {
        $set: {
        status: 'cancelled',
       cancellationReason:  'ai_assistant',
         },
           },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!appointment) {
      return NextResponse.json(
        {
          error:
            'This appointment cannot be cancelled. It may not exist, may belong to another patient, or may already be past or cancelled.',
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Appointment cancelled successfully.',
      appointmentId: String(appointment._id),
    });
  } catch (error) {
    console.error('Cancel appointment API error:', error);

    return NextResponse.json(
      { error: 'Could not cancel the appointment. Please try again.' },
      { status: 500 }
    );
  }
}
