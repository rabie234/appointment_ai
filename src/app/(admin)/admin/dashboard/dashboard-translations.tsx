
"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/components/i18n/translations";

export function DashboardText({
    text,
    className,
}: {
    text: string;
    className?: string;
}) {
    const { language } = useLanguage();

    return (
        <span
            dir={language === "ar" ? "rtl" : "ltr"}
            className={className}
        >
            {t(language, text)}
        </span>
    );
}

export function DashboardStatNote({
    kind,
    first,
    second = 0,
    third = 0,
}: {
    kind: "doctors" | "today" | "patients";
    first: number;
    second?: number;
    third?: number;
}) {
    const { language } = useLanguage();
    const isArabic = language === "ar";

    const formatNumber = (value: number) =>
        new Intl.NumberFormat(isArabic ? "ar" : "en").format(value);

    return (
        <span dir={isArabic ? "rtl" : "ltr"}>
            {kind === "doctors" && (
                isArabic
                    ? `${formatNumber(first)} في إجازة · ${formatNumber(second)} غير نشط`
                    : `${formatNumber(first)} on leave · ${formatNumber(second)} inactive`
            )}

            {kind === "today" && (
                isArabic
                    ? `${formatNumber(first)} مكتمل · ${formatNumber(second)} متبقي`
                    : `${formatNumber(first)} completed · ${formatNumber(second)} to go`
            )}

            {kind === "patients" && (
                isArabic
                    ? `من أصل ${formatNumber(first)} مسجل · ${formatNumber(second)} جدد خلال ${formatNumber(third)} يومًا`
                    : `of ${formatNumber(first)} registered · ${formatNumber(second)} new in ${formatNumber(third)} days`
            )}
        </span>
    );
}
export function DashboardTime({ time }: { time: string }) {
  const { language } = useLanguage();

  const [hours, minutes] = time.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return <span>{time}</span>;
  }

  return (
    <span dir={language === "ar" ? "rtl" : "ltr"}>
      {new Intl.DateTimeFormat(
        language === "ar" ? "ar-LB" : "en-US",
        {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }
      ).format(new Date(2000, 0, 1, hours, minutes))}
    </span>
  );
}


export function DashboardDate({
  date,
  kind,
}: {
  date: string;
  kind: "day" | "month-day";
}) {
  const { language } = useLanguage();

  const parsedDate = new Date(`${date}T12:00:00Z`);

  const options: Intl.DateTimeFormatOptions =
    kind === "day"
      ? { weekday: "short", timeZone: "UTC" }
      : { month: "short", day: "numeric", timeZone: "UTC" };

  return (
    <span dir={language === "ar" ? "rtl" : "ltr"}>
      {new Intl.DateTimeFormat(
        language === "ar" ? "ar-LB" : "en-US",
        options
      ).format(parsedDate)}
    </span>
  );
}
export function DashboardDoctorName({
  name,
  nameAr,
}: {
  name: string;
  nameAr?: string;
}) {
  const { language } = useLanguage();

  const displayName =
    language === "ar" ? nameAr?.trim() || name : name;

  return (
    <span dir={language === "ar" ? "rtl" : "ltr"}>
      {displayName}
    </span>
  );
}
export function DashboardSpecialty({
  specialty,
}: {
  specialty: string;
}) {
  const { language } = useLanguage();

  return (
    <span dir={language === "ar" ? "rtl" : "ltr"}>
      {t(language, specialty)}
    </span>
  );
}