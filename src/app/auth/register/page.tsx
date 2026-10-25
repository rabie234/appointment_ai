"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import Link from "next/link"
import { register, type RegisterState } from "../actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HeartPulse, Loader2 } from "lucide-react"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"
const fields = [
    { id: "name", label: "Full Name", type: "text", placeholder: "John Doe", autoComplete: "name" },
    { id: "email", label: "Email", type: "email", placeholder: "name@example.com", autoComplete: "email" },
    { id: "password", label: "Password", type: "password", placeholder: "••••••••", autoComplete: "new-password" },
    { id: "confirmPassword", label: "Confirm Password", type: "password", placeholder: "••••••••", autoComplete: "new-password" },
] as const

function SubmitButton() {
    const { pending } = useFormStatus()
    const { language } = useLanguage()
    return (
        <Button type="submit" className="w-full h-11 shadow-lg shadow-blue-200" disabled={pending}>
            {pending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t(language, "Creating account...")}
                </>
            ) : (
                t(language, "Sign up")
            )}
        </Button>
    )
}

export default function RegisterPage() {
    const [state, formAction] = useActionState<RegisterState, FormData>(register, {})
    const { language } = useLanguage()
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background p-4">
            <Card className="w-full max-w-md border-none shadow-xl bg-card/60 backdrop-blur-sm">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
                            <HeartPulse className="h-7 w-7" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold"> {t(language,"Create an account")}</CardTitle>
                    <CardDescription>{t(language,"Sign up to get started with ClinicAI")}</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={formAction} className="space-y-4">
                        {state.error && (
                            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                                {state.error}
                            </div>
                        )}

                        {fields.map((field) => (
                            <div key={field.id} className="space-y-2">
                                <label htmlFor={field.id} className="text-sm font-medium">
                                    {t(language, field.label)}
                                </label>
                                <Input
                                    id={field.id}
                                    name={field.id}
                                    type={field.type}
                                    autoComplete={field.autoComplete}
                                    placeholder={
                                  field.id === "name"
                                    ? t(language, field.placeholder)
                                  : field.placeholder
}
                                    required
                                    className="h-11"
                                />
                            </div>
                        ))}

                        <SubmitButton />
                    </form>
                    <div className="mt-4 text-center text-sm">
                        <span className="text-muted-foreground"> {t(language, "Already have an account?")}  </span>
                        <Link href="/auth/login" className="text-primary font-medium hover:underline">
                            {t(language,"Sign in")}
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
