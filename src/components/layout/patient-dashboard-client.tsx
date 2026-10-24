
"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/components/i18n/translations";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  PlusCircle,
  MessageSquare,
  Users,
  Calendar,
  ArrowRight,
  Clock,
  User,
  Sparkles,
  Stethoscope,
} from "lucide-react";

type DashboardProps = {
  firstName: string;
  upcomingCount: number;
  doctorCount: number;
  appointment: null | {
    doctorName: string;
    specialty: string;
    date: string;
    time: string;
  };
};

const QUICK_ACTIONS = [
  { title: "Book Appointment", icon: PlusCircle, color: "bg-blue-500", href: "/doctors" },
  { title: "Chat with AI", icon: MessageSquare, color: "bg-purple-500", href: "/ai-chat" },
  { title: "View Doctors", icon: Users, color: "bg-emerald-500", href: "/doctors" },
  { title: "My Appointments", icon: Calendar, color: "bg-orange-500", href: "/appointments" },
];

function formatDate(date: string, language: "en" | "ar") {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-LB" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

function formatTime(time: string, language: "en" | "ar") {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;

  return new Intl.DateTimeFormat(language === "ar" ? "ar-LB" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 1, h, m)));
}

export default function PatientDashboardClient({
  firstName,
  upcomingCount,
  doctorCount,
  appointment,
}: DashboardProps) {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  return (
   <div
  dir={isArabic ? "rtl" : "ltr"}
  className="w-full min-w-0 max-w-full space-y-8 overflow-x-clip animate-in fade-in duration-500"
>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t(language, "Welcome back")}, {firstName}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t(language, "Your health is our priority. How can we help you today?")}
          </p>
        </div>

        <Link href="/ai-chat">
          <Button className="gap-2 shadow-lg shadow-blue-100">
            <Sparkles className="h-4 w-4" />
            {t(language, "Ask ClinicAI")}
          </Button>
        </Link>
      </div>

     <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
        <StatCard
          label={t(language, "Upcoming visits")}
          value={new Intl.NumberFormat(isArabic ? "ar-LB" : "en-US").format(upcomingCount)}
          icon={<Calendar className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label={t(language, "Doctors available")}
          value={new Intl.NumberFormat(isArabic ? "ar-LB" : "en-US").format(doctorCount)}
          icon={<Stethoscope className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label={t(language, "AI assistant")}
          value={t(language, "Online")}
          icon={<MessageSquare className="h-5 w-5" />}
          tone="purple"
        />
        <StatCard
          label={t(language, "Next visit")}
          value={appointment ? t(language, "Scheduled") : t(language, "None")}
          icon={<Clock className="h-5 w-5" />}
          tone="orange"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.title} href={action.href}>
            <Card className="group hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer border-none bg-card/60">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`${action.color} p-2 rounded-lg text-white`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold">
                    {t(language, action.title)}
                  </span>
                </div>
                <ArrowRight
                  className={`h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ${
                    isArabic ? "rotate-180" : ""
                  }`}
                />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {t(language, "Upcoming Appointment")}
            </h2>
            <Link
              href="/appointments"
              className="text-primary text-sm font-medium hover:underline"
            >
              {t(language, "View all")}
            </Link>
          </div>

          {appointment ? (
            <Card className="border-none shadow-sm overflow-hidden bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <User className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">
                      {appointment.doctorName || t(language, "Doctor")}
                    </h3>
                    <p className="text-primary text-sm font-medium">
                      {t(language, appointment.specialty)}
                    </p>
                    <div className="flex flex-wrap items-center mt-2 text-sm text-muted-foreground gap-x-4 gap-y-1">
                      <span className="flex items-center">
                        <Calendar className="me-1.5 h-4 w-4 text-primary" />
                        {formatDate(appointment.date, language)}
                      </span>
                      <span className="flex items-center">
                        <Clock className="me-1.5 h-4 w-4 text-primary" />
                        {formatTime(appointment.time, language)}
                      </span>
                    </div>
                  </div>
                </div>
                <Link href="/appointments">
                  <Button size="sm">{t(language, "Manage")}</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed bg-card/40">
              <CardContent className="p-8 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">
                  {t(language, "No upcoming appointments")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t(language, "Book a visit or ask the AI assistant to help.")}
                </p>
                <div className="flex justify-center gap-2 mt-4">
                  <Link href="/doctors">
                    <Button size="sm">{t(language, "Find a doctor")}</Button>
                  </Link>
                  <Link href="/ai-chat">
                    <Button size="sm" variant="outline">
                      {t(language, "Ask ClinicAI")}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
            {t(language, "AI Assistant")}
          </h2>
          <Card className="border-none shadow-sm bg-gradient-to-br from-purple-500/10 to-primary/5">
            <CardContent className="p-5 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t(language, "Describe your symptoms and I'll suggest the right doctor and an available time to book.")}
              </p>
              <Link href="/ai-chat">
                <Button variant="secondary" size="sm" className="w-full">
                  {t(language, "Start a conversation")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "blue" | "emerald" | "purple" | "orange";
}) {
  const tones = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    purple: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
    orange: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  };

  return (
    <Card className="border-none bg-card/60 shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${tones[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground truncate mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
