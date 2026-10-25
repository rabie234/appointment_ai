
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
