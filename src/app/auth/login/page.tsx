"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { login, type LoginState } from "../actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HeartPulse, Loader2, CheckCircle2 } from "lucide-react"

function SubmitButton() {
    const { pending } = useFormStatus()

    return (
        <Button type="submit" className="w-full h-11 shadow-lg shadow-blue-200" disabled={pending}>
            {pending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                </>
            ) : (
                "Sign in"
            )}
        </Button>
    )
}

function LoginForm() {
    const searchParams = useSearchParams()
    const [state, formAction] = useActionState<LoginState, FormData>(login, {})

    const justRegistered = searchParams.get("registered") === "true"
    const callbackUrl = searchParams.get("callbackUrl") ?? ""

    return (
        <form action={formAction} className="space-y-4">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />

            {justRegistered && !state.error && (
                <div className="p-3 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Account created successfully! Please sign in.
                </div>
            )}
            {state.error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                    {state.error}
                </div>
            )}

            <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                    Email
                </label>
                <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    required
                    className="h-11"
                />
            </div>
            <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                    Password
                </label>
                <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    required
                    className="h-11"
                />
            </div>

            <SubmitButton />
        </form>
    )
}

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background p-4">
            <Card className="w-full max-w-md border-none shadow-xl bg-card/60 backdrop-blur-sm">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
                            <HeartPulse className="h-7 w-7" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
                    <CardDescription>Sign in to your ClinicAI account</CardDescription>
                </CardHeader>
                <CardContent>
                    {/* useSearchParams needs a Suspense boundary during prerender. */}
                    <Suspense fallback={<div className="h-64" />}>
                        <LoginForm />
                    </Suspense>
                    <div className="mt-4 text-center text-sm">
                        <span className="text-muted-foreground">Don&apos;t have an account? </span>
                        <Link href="/auth/register" className="text-primary font-medium hover:underline">
                            Sign up
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
