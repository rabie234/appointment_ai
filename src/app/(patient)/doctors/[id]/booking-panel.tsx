
"use client"

import { useState, useTransition, useActionState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"
import {
    Calendar as CalendarIcon,
    Video,
    MapPin,
    Loader2,
    CheckCircle2,
} from "lucide-react"
import { getAvailableSlots, bookAppointment, type BookingState } from "./actions"

function upcomingDays(count: number, language: "en" | "ar") {
    const out: { value: string; label: string; weekday: string }[] = []
    const today = new Date()

    for (let i = 0; i < count; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() + i)

        out.push({
            value: d.toISOString().slice(0, 10),
            label: d.toLocaleDateString(language === "ar" ? "ar-LB" : "en-US", {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
            }),
            weekday: d.toLocaleDateString(language === "ar" ? "ar-LB" : "en-US", {
                weekday: "short",
                timeZone: "UTC",
            }),
        })
    }

    return out
}

function pretty(time: string, language: "en" | "ar"): string {
    const [h, m] = time.split(":").map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return time

    const date = new Date(Date.UTC(2026, 0, 1, h, m))

    return new Intl.DateTimeFormat(language === "ar" ? "ar-LB" : "en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "UTC",
    }).format(date)
}

export function BookingPanel({
    doctorId,
    fee,
    active,
}: {
    doctorId: string
    fee: number
    active: boolean
}) {
    const { language } = useLanguage()
    const days = upcomingDays(14, language)
    const [selectedDate, setSelectedDate] = useState(days[0].value)
    const [selectedTime, setSelectedTime] = useState<string | null>(null)
    const [type, setType] = useState<"in-person" | "video">("in-person")
    const [slots, setSlots] = useState<string[]>([])
    const [loadingSlots, startLoadingSlots] = useTransition()
    const [state, formAction] = useActionState<BookingState, FormData>(bookAppointment, {})

    useEffect(() => {
        if (!active) return

        startLoadingSlots(async () => {
            const res = await getAvailableSlots(doctorId, selectedDate)
            setSlots(res.slots ?? [])
        })
    }, [selectedDate, doctorId, active])

    function pickDate(value: string) {
        setSelectedTime(null)
        setSelectedDate(value)
    }

    if (state.success) {
        return (
            <Card className="sticky top-24 border-none shadow-lg bg-card">
                <CardContent className="py-12 text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">
                            {t(language, "Appointment requested")}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t(language, "Your booking is pending confirmation. Track it under My Appointments.")}
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => window.location.assign("/appointments")}>
                        {t(language, "Go to My Appointments")}
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="sticky top-24 border-none shadow-lg bg-card">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-primary" />
                    {t(language, "Book Appointment")}
                </CardTitle>
            </CardHeader>

            <CardContent>
                {!active ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                        {t(language, "This doctor is currently not accepting appointments.")}
                    </p>
                ) : (
                    <form action={formAction} className="space-y-6">
                        <input type="hidden" name="doctorId" value={doctorId} />
                        <input type="hidden" name="date" value={selectedDate} />
                        <input type="hidden" name="time" value={selectedTime ?? ""} />
                        <input type="hidden" name="type" value={type} />

                        <div>
                            <p className="text-sm font-semibold mb-3 tracking-tight">
                                {t(language, "Select Date")}
                            </p>
                            <div className="grid grid-cols-4 gap-2">
                                {days.slice(0, 8).map((d) => (
                                    <button
                                        type="button"
                                        key={d.value}
                                        onClick={() => pickDate(d.value)}
                                        className={cn(
                                            "px-1 py-2 text-xs rounded-lg border transition-all flex flex-col items-center",
                                            selectedDate === d.value
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "hover:border-primary hover:text-primary"
                                        )}
                                    >
                                        <span className="opacity-70">{d.weekday}</span>
                                        <span className="font-semibold">{d.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="text-sm font-semibold mb-3 tracking-tight">
                                {t(language, "Visit Type")}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    { key: "in-person", label: "In-Person", Icon: MapPin },
                                    { key: "video", label: "Video Call", Icon: Video },
                                ] as const).map(({ key, label, Icon }) => (
                                    <button
                                        type="button"
                                        key={key}
                                        onClick={() => setType(key)}
                                        className={cn(
                                            "flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-lg border transition-all",
                                            type === key
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "hover:border-primary hover:text-primary"
                                        )}
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                        {t(language, label)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="text-sm font-semibold mb-3 tracking-tight">
                                {t(language, "Select Time Slot")}
                            </p>

                            {loadingSlots ? (
                                <div className="flex items-center justify-center py-8 text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                </div>
                            ) : slots.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-6 text-center border rounded-lg">
                                    {t(language, "No available slots on this day.")}
                                </p>
                            ) : (
                                <div className="grid grid-cols-3 gap-2">
                                    {slots.map((time) => (
                                        <button
                                            type="button"
                                            key={time}
                                            onClick={() => setSelectedTime(time)}
                                            className={cn(
                                                "px-2 py-2 text-xs rounded-lg border transition-all",
                                                selectedTime === time
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "hover:border-primary hover:text-primary"
                                            )}
                                        >
                                            {pretty(time, language)}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {state.error && (
                            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                                {state.error}
                            </p>
                        )}

                        <div className="pt-4 border-t space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">
                                    {t(language, "Consultation Fee")}
                                </span>
                                <span className="font-bold text-lg">${fee.toFixed(2)}</span>
                            </div>

                            <BookButton
                                disabled={!selectedTime}
                                language={language}
                            />

                            <p className="text-[10px] text-center text-muted-foreground px-4">
                                {t(language, "You won't be charged yet. Payment is handled at the clinic.")}
                            </p>
                        </div>
                    </form>
                )}
            </CardContent>
        </Card>
    )
}

function BookButton({
    disabled,
    language,
}: {
    disabled: boolean
    language: "en" | "ar"
}) {
    const { pending } = useFormStatus()

    return (
        <Button
            type="submit"
            disabled={disabled || pending}
            className="w-full py-6 text-lg shadow-xl shadow-blue-200 gap-2"
        >
            {pending && <Loader2 className="h-5 w-5 animate-spin" />}
            {t(language, "Book Now")}
        </Button>
    )
}
