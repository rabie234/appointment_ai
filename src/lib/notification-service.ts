import connectDB from "@/lib/mongodb"
import Appointment from "@/models/Appointment"
import Doctor from "@/models/Doctor"
import Notification, {
    type NotificationCategory,
} from "@/models/Notification"
import User from "@/models/User"

export type NotificationDraft = {
    category: NotificationCategory
    titleKey: string
    bodyKey: string
    href: string
    context?: string
}

export async function notifyUser(
    recipientId: string,
    notification: NotificationDraft
) {
    try {
        await connectDB()
        await Notification.create({
            recipient: recipientId,
            ...notification,
        })
    } catch (error) {
        console.error("Create in-app notification failed:", error)
    }
}

export async function notifyAdmins(notification: NotificationDraft) {
    try {
        await connectDB()
        const admins = await User.find({ role: "admin" })
            .select("_id")
            .lean()

        await Promise.all(
            admins.map((admin) =>
                notifyUser(String(admin._id), notification)
            )
        )
    } catch (error) {
        console.error("Notify administrators failed:", error)
    }
}

export async function notifyDoctor(
    doctorId: string,
    notification: NotificationDraft
) {
    try {
        await connectDB()
        const doctor = await Doctor.findById(doctorId)
            .select("user")
            .lean()

        if (doctor?.user) {
            await notifyUser(String(doctor.user), notification)
        }
    } catch (error) {
        console.error("Notify doctor failed:", error)
    }
}

export async function notifyAppointmentParties(
    appointmentId: string,
    patientNotification: NotificationDraft,
    doctorNotification: NotificationDraft
) {
    try {
        await connectDB()
        const appointment = await Appointment.findById(appointmentId)
            .select("patient doctor date time")
            .lean()

        if (!appointment) return

        const [patient, doctor] = await Promise.all([
            User.findById(appointment.patient).select("name").lean(),
            Doctor.findById(appointment.doctor)
                .select("user name")
                .lean(),
        ])

        const date = new Date(appointment.date)
            .toISOString()
            .slice(0, 10)

        const patientContext =
            patientNotification.context ??
            [doctor?.name, date, appointment.time].filter(Boolean).join(" · ")
        const doctorContext =
            doctorNotification.context ??
            [patient?.name, date, appointment.time].filter(Boolean).join(" · ")

        const tasks: Promise<void>[] = []

        tasks.push(
            notifyUser(String(appointment.patient), {
                ...patientNotification,
                context: patientContext,
            })
        )

        if (doctor?.user) {
            tasks.push(
                notifyUser(String(doctor.user), {
                    ...doctorNotification,
                    context: doctorContext,
                })
            )
        }

        await Promise.all(tasks)
    } catch (error) {
        console.error("Notify appointment participants failed:", error)
    }
}

export async function notifyPatientsAffectedByLeave(
    doctorId: string,
    startDate: Date,
    endDate: Date
) {
    try {
        await connectDB()

        const [appointments, doctor] = await Promise.all([
            Appointment.find({
                doctor: doctorId,
                date: { $gte: startDate, $lt: endDate },
                status: { $in: ["pending", "confirmed"] },
            })
                .select("patient date time")
                .lean(),
            Doctor.findById(doctorId).select("name").lean(),
        ])

        await Promise.all(
            appointments.map((appointment) =>
                notifyUser(String(appointment.patient), {
                    category: "appointment",
                    titleKey: "Notification: Doctor leave affects appointment",
                    bodyKey:
                        "Notification body: Your appointment is affected by approved doctor leave.",
                    href: "/appointments",
                    context: [
                        doctor?.name,
                        new Date(appointment.date).toISOString().slice(0, 10),
                        appointment.time,
                    ]
                        .filter(Boolean)
                        .join(" · "),
                })
            )
        )
    } catch (error) {
        console.error("Notify patients about doctor leave failed:", error)
    }
}