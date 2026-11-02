import { Card, CardContent } from "@/components/ui/card"

/** Shown when a doctor login exists but its clinic profile was removed. */
export function NoProfile() {
    return (
        <Card className="border-none shadow-sm bg-card/60">
            <CardContent className="py-16 text-center space-y-2">
                <h1 className="text-xl font-bold">No doctor profile linked</h1>
                <p className="text-sm text-muted-foreground">
                    This login is not linked to a doctor profile. Please contact the clinic administrator.
                </p>
            </CardContent>
        </Card>
    )
}
