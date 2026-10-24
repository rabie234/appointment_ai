
"use client";

import { useLanguage } from "@/components/i18n/language-provider";

export function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();

    return (
        <div
            className="inline-flex items-center gap-1 rounded-lg border p-1"
            role="group"
            aria-label={language === "ar" ? "اختر اللغة" : "Choose language"}
        >
            <button
                type="button"
                lang="en"
                onClick={() => setLanguage("en")}
                aria-pressed={language === "en"}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    language === "en"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                }`}
            >
                English
            </button>

            <button
                type="button"
                lang="ar"
                onClick={() => setLanguage("ar")}
                aria-pressed={language === "ar"}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    language === "ar"
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                }`}
            >
                العربية
            </button>
        </div>
    );
}
