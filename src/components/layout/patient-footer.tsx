
"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { t } from "@/components/i18n/translations";

export function PatientFooter() {
  const { language } = useLanguage();

  return (
    <footer
      dir={language === "ar" ? "rtl" : "ltr"}
      className="border-t py-6 md:py-0"
    >
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 md:h-16 md:flex-row">
        <p className="text-sm text-muted-foreground">
          © 2026 ClinicAI Healthcare. {t(language, "All rights reserved.")}
        </p>

        <div className="flex items-center gap-4">
          <a
            href="#"
            className="text-sm text-muted-foreground hover:underline"
          >
            {t(language, "Privacy Policy")}
          </a>

          <a
            href="#"
            className="text-sm text-muted-foreground hover:underline"
          >
            {t(language, "Terms of Service")}
          </a>
        </div>
      </div>
    </footer>
  );
}
