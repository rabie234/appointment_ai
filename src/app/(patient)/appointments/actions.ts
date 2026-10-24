
"use server"

import { revalidatePath } from "next/cache"
import mongoose from "mongoose"
import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import Appointment from "@/models/Appointment"

export async function cancelPendingAppointment(appointmentId: string) {
    try {
        const session = await requireRole("patient")

        if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
            return {
                success: false,
                message: "Invalid appointment",
            }
        }

        await connectDB()

        const appointment = await Appointment.findOneAndUpdate(
            {
                _id: appointmentId,
                patient: session.user.id,
                status: "pending",
            },
            {
                $set: {
                    status: "cancelled",
                    cancellationReason: "Cancelled by you",
                },
            },
            {
                new: true,
            }
        )

        if (!appointment) {
            return {
                success: false,
                message: "Appointment cannot be cancelled",
            }
        }

        revalidatePath("/appointments")

        return {
            success: true,
            message: "Cancelled by you",
        }
    } catch (error) {
        console.error("Failed to cancel appointment:", error)

        return {
            success: false,
            message: "Cancellation failed",
        }
    }
}
