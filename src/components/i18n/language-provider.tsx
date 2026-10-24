"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";

export type Language = "en" | "ar";

type LanguageContextValue = {
    language: Language;
    setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>("en");
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem("clinicai-language");
        const cookie = document.cookie
            .split("; ")
            .find((item) => item.startsWith("clinicai-language="))
            ?.split("=")[1];

        const preferred = saved || cookie;

        if (preferred === "ar" || preferred === "en") {
            setLanguageState(preferred);
        } else if (navigator.language.toLowerCase().startsWith("ar")) {
            setLanguageState("ar");
        }

        setReady(true);
    }, []);

    useEffect(() => {
        document.documentElement.lang = language;
        document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
        document.documentElement.setAttribute("data-language", language);
    }, [language]);

    const setLanguage = useCallback((next: Language) => {
        setLanguageState(next);
        localStorage.setItem("clinicai-language", next);
        document.cookie = `clinicai-language=${next}; path=/; max-age=31536000; SameSite=Lax`;
    }, []);

    return (
        <LanguageContext.Provider value={{ language, setLanguage }}>
            <div data-language-ready={ready ? "true" : "false"}>
                {children}
            </div>
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);

    if (!context) {
        throw new Error("useLanguage must be used inside LanguageProvider");
    }

    return context;
}
