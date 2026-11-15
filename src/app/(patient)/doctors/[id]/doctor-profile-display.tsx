"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  MapPin,
  ChevronLeft,
  ShieldCheck,
  Award,
  BookOpen,
} from "lucide-react";
import {
  useLanguage,
  type Language,
} from "@/components/i18n/language-provider";
import { t } from "@/components/i18n/translations";
import { BookingPanel } from "./booking-panel";

type DoctorData = {
  id: string;
  name: string;
  nameAr: string;
  image: string;
  specialty: string;
  experience: string | number;
  successRate: number | null;
  totalPatients: number;
  active: boolean;
};

type WorkingDay = {
  day: string;
  intervals: {
    open: string;
    close: string;
  }[];
};

type StatCardProps = {
  icon: ReactNode;
  tone: "blue" | "emerald" | "orange";
  label: string;
  value: string;
  language: Language;
};

const STAT_CARD_TONES = {
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  emerald:
    "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  orange:
    "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
};

function StatCard({
  icon,
  tone,
  label,
  value,
  language,
}: StatCardProps) {
  return (
    <Card className="border-none bg-card/50 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg p-2 ${STAT_CARD_TONES[tone]}`}>
          {icon}
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            {t(language, label)}
          </p>
          <p className="text-sm font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DoctorProfileDisplay({
  doctor,
  workingDays,
  openWeekdays,
  consultationFee,
}: {
  doctor: DoctorData;
  workingDays: WorkingDay[];
  openWeekdays: string[];
  consultationFee: number;
}) {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const doctorName =
    isArabic && doctor.nameAr ? doctor.nameAr : doctor.name;

  function formatExperience(value: string | number) {
    const match = String(value).match(/\d+/);

    if (!match) return String(value);

    const number = match[0];

    return isArabic ? `${number} سنوات` : `${number} Years`;
  }

  function formatTime(time: string) {
    const [hours, minutes] = time.split(":").map(Number);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;

    const date = new Date(Date.UTC(2020, 0, 1, hours, minutes));

    return new Intl.DateTimeFormat(isArabic ? "en-GB" : "en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    }).format(date);
  }

  function translateDay(day: string) {
    return t(language, day);
  }

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className="animate-in fade-in space-y-8 duration-500"
    >
      <Link
        href="/doctors"
        className="inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ChevronLeft
          className={`me-1 h-4 w-4 ${isArabic ? "rotate-180" : ""}`}
        />
        {t(language, "Back to search")}
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section className="flex flex-col gap-6 md:flex-row md:items-end">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-muted shadow-xl">
              {doctor.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={doctor.image}
                  alt={doctorName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-4xl font-bold text-primary/40">
                  {doctorName.replace(/^Dr\.?\s*/i, "").charAt(0)}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">
                  {doctorName}
                </h1>
              </div>

              <p className="text-lg font-semibold text-primary">
                {t(language, doctor.specialty)}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <MapPin className="me-1 h-4 w-4 text-primary" />
                  {t(language, "Downtown Medical Center")}
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              icon={<ShieldCheck className="h-5 w-5" />}
              tone="blue"
              label="Experience"
              value={
                doctor.experience
                  ? formatExperience(doctor.experience)
                  : "—"
              }
              language={language}
            />

            <StatCard
              icon={<Award className="h-5 w-5" />}
              tone="emerald"
              label="Success Rate"
              value={
                doctor.successRate === null
                  ? "N/A"
                  : `${doctor.successRate}%`
              }
              language={language}
            />

            <StatCard
              icon={<BookOpen className="h-5 w-5" />}
              tone="orange"
              label="Total Patients"
              value={doctor.totalPatients.toLocaleString(
                isArabic ? "en-GB" : "en-US"
              )}
              language={language}
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold">
              {t(language, "Working Hours")}
            </h2>

            <div className="overflow-hidden rounded-xl border bg-card/50">
              {workingDays.length === 0 ? (
                <p className="px-6 py-4 text-sm text-muted-foreground">
                  {t(
                    language,
                    "No working hours set for this doctor yet."
                  )}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <tbody className="divide-y">
                    {workingDays.map((item) => (
                      <tr
                        key={item.day}
                        className="transition-colors hover:bg-accent/50"
                      >
                        <td className="px-6 py-3 font-medium">
                          {translateDay(item.day)}
                        </td>

                        <td
                          dir="ltr"
                          className="px-6 py-3 text-start text-muted-foreground"
                        >
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {item.intervals.map((interval, index) => (
                              <span
                                key={`${item.day}-${index}`}
                                className="whitespace-nowrap"
                              >
                                {formatTime(interval.open)} –{" "}
                                {formatTime(interval.close)}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <BookingPanel
            doctorId={doctor.id}
            fee={consultationFee}
            active={doctor.active}
            openWeekdays={openWeekdays}
          />
        </div>
      </div>
    </div>
  );
}