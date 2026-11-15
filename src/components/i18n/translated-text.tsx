
"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/components/i18n/translations";

export default function TranslatedText({
    text,
}: {
    text: string;
}) {
    const { language } = useLanguage();

    return <>{t(language, text)}</>;
}
