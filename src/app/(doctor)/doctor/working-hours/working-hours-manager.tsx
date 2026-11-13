"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/components/i18n/translations";
import { WeekEditor } from "@/components/schedule/week-editor";
import {
  intersectSchedules,
  type DayHours,
  type TimeInterval,
} from "@/lib/schedule";
import {
  acknowledgeClinicHours,
  requestMyScheduleChange,
  type AccountFormState,
} from "../account/actions";

export type ScheduleChangeRequestView = {
  id: string;
  requestedSchedule: DayHours[];
  status: "pending" | "approved" | "rejected" | "cancelled";
  adminNote: string;
  requestedAt: string;
};

function SubmitButton({
  disabled,
  children,
}: {
  disabled?: boolean;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={disabled || pending} className="gap-2">
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}

function ScheduleFeedback({
  state,
  language,
}: {
  state: AccountFormState;
  language: "ar" | "en";
}) {
  if (state.error) {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {t(language, state.error)}
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
        {t(language, state.success)}
      </p>
    );
  }

  return null;
}

function dayIntervals(day: DayHours): TimeInterval[] {
  if (day.closed) return [];
  if (Array.isArray(day.intervals)) return day.intervals;
  return [{ open: day.open, close: day.close }];
}

function formatDayHours(day: DayHours, language: "ar" | "en"): string {
  if (day.closed) return t(language, "Off");

  const intervals = dayIntervals(day);
  if (intervals.length === 0) return t(language, "Off");

  return intervals
    .map((interval) => `${interval.open}–${interval.close}`)
    .join(" · ");
}

function sameDayHours(left: DayHours, right?: DayHours): boolean {
  if (!right) return false;
  if (left.closed || right.closed) return left.closed === right.closed;

  const leftIntervals = dayIntervals(left);
  const rightIntervals = dayIntervals(right);

  return (
    leftIntervals.length === rightIntervals.length &&
    leftIntervals.every(
      (interval, index) =>
        interval.open === rightIntervals[index]?.open &&
        interval.close === rightIntervals[index]?.close
    )
  );
}

function ScheduleCard({
  title,
  schedule,
  language,
  limitedDays,
}: {
  title: string;
  schedule: DayHours[];
  language: "ar" | "en";
  limitedDays?: Set<string>;
}) {
  return (
    <Card className="bg-card/60">
      <CardHeader>
        <CardTitle className="text-xl">{t(language, title)}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  {t(language, "Day")}
                </th>
                <th scope="col" className="px-3 py-3 text-start font-medium">
                  {t(language, "Working hours")}
                </th>
                {limitedDays && (
                  <th scope="col" className="px-3 py-3 text-start font-medium">
                    {t(language, "Availability")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {schedule.map((day) => {
                const isLimited = limitedDays?.has(day.day) ?? false;

                return (
                  <tr key={day.day} className="border-b last:border-0">
                    <th
                      scope="row"
                      className="px-3 py-3 text-start font-medium"
                    >
                      {t(language, day.day)}
                    </th>
                    <td className="px-3 py-3 tabular-nums" dir="ltr">
                      {formatDayHours(day, language)}
                    </td>
                    {limitedDays && (
                      <td className="px-3 py-3">
                        {isLimited ? (
                          <Badge variant="destructive">
                            {t(language, "Limited by clinic hours")}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkingHoursManager({
  currentSchedule,
  clinicSchedule,
  clinicHoursVersion,
  acknowledgedClinicHoursVersion,
  requests,
}: {
  currentSchedule: DayHours[];
  clinicSchedule: DayHours[];
  clinicHoursVersion: string;
  acknowledgedClinicHoursVersion: string;
  requests: ScheduleChangeRequestView[];
}) {
  const { language } = useLanguage();
  const hasPendingRequest = requests.some(
    (request) => request.status === "pending"
  );

  const [state, formAction] = useActionState<AccountFormState, FormData>(
    requestMyScheduleChange,
    {}
  );

  const effectiveSchedule = intersectSchedules(currentSchedule, clinicSchedule);
  const effectiveByDay = new Map(
    effectiveSchedule.map((day) => [day.day, day])
  );
  const limitedDays = new Set(
    currentSchedule
      .filter((day) => !sameDayHours(day, effectiveByDay.get(day.day)))
      .map((day) => day.day)
  );
  const hasClinicHoursConflict = limitedDays.size > 0;
  const needsClinicHoursReview =
    clinicHoursVersion !== acknowledgedClinicHoursVersion;

  const dateFormatter = new Intl.DateTimeFormat(
    language === "ar" ? "ar-LB" : "en-US",
    { year: "numeric", month: "short", day: "numeric" }
  );

  return (
    <div
      className="animate-in fade-in space-y-8 duration-500"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t(language, "Working Hours")}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {t(language, "Schedule changes need administrator approval.")}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ScheduleCard
          title="Saved doctor working hours"
          schedule={currentSchedule}
          language={language}
          limitedDays={limitedDays}
        />
        <ScheduleCard
          title="Patient bookable hours"
          schedule={effectiveSchedule}
          language={language}
        />
        <ScheduleCard
          title="Current clinic hours"
          schedule={clinicSchedule}
          language={language}
        />
      </div>

      {hasClinicHoursConflict ? (
        <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <p>
            {t(
              language,
              "Some saved doctor hours fall outside clinic hours. Patient booking is limited to the overlapping times. Reviewing clinic hours does not expand your saved schedule."
            )}
          </p>
          {needsClinicHoursReview && (
            <form action={acknowledgeClinicHours}>
              <SubmitButton>
                {t(language, "I Reviewed Clinic Hours")}
              </SubmitButton>
            </form>
          )}
        </div>
      ) : needsClinicHoursReview ? (
        <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <p>
            {t(
              language,
              "Clinic hours changed. Your saved doctor hours remain unchanged. Review the update."
            )}
          </p>
          <form action={acknowledgeClinicHours}>
            <SubmitButton>
              {t(language, "I Reviewed Clinic Hours")}
            </SubmitButton>
          </form>
        </div>
      ) : (
        <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
          {t(
            language,
            "Patient slots follow the overlapping clinic and doctor hours."
          )}
        </p>
      )}

      <Card className="border-none bg-card/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">
            {t(language, "Request a schedule change")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasPendingRequest && (
            <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              {t(language, "You already have a pending schedule-change request.")}
            </p>
          )}

          <form action={formAction} className="max-w-3xl space-y-4">
            <fieldset disabled={hasPendingRequest} className="space-y-4">
              <WeekEditor
                prefix="doctor"
                initial={currentSchedule}
                closedLabel={t(language, "Off")}
              />

              <ScheduleFeedback state={state} language={language} />

              <div className="flex justify-end">
                <SubmitButton disabled={hasPendingRequest}>
                  {t(language, "Submit schedule change")}
                </SubmitButton>
              </div>
            </fieldset>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          {t(language, "Schedule change history")}
        </h2>

        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t(language, "No schedule change requests yet.")}
          </p>
        ) : (
          requests.map((request) => (
            <Card key={request.id} className="bg-card/60">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {dateFormatter.format(new Date(request.requestedAt))}
                  </p>
                  <Badge variant="secondary">
                    {t(language, request.status)}
                  </Badge>
                </div>

                <div className="grid gap-1 text-sm sm:grid-cols-2">
                  {request.requestedSchedule.map((day) => (
                    <p key={day.day}>
                      {t(language, day.day)}: {formatDayHours(day, language)}
                    </p>
                  ))}
                </div>

                {request.adminNote && (
                  <p className="border-t pt-3 text-sm">
                    {t(language, "Administrator note")}: {request.adminNote}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}