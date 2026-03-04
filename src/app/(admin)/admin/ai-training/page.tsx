"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    FileUp,
    BrainCircuit,
    Settings2,
    History,
    BarChart,
    Plus,
    CheckCircle2,
    Clock,
    AlertCircle
} from "lucide-react"

export default function AdminAITrainingPage() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">AI Training & Intelligence</h1>
                    <p className="text-muted-foreground mt-1">Train and optimize the ClinicAI assistant with new data.</p>
                </div>
                <Button className="shadow-lg shadow-blue-200 gap-2">
                    <BrainCircuit className="h-4 w-4" />
                    Launch Trainer
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Training Data Upload */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-sm bg-card/60">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xl">Upload Training Data</CardTitle>
                                <Badge variant="secondary">JSON / PDF / TXT</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="border-2 border-dashed border-primary/20 rounded-2xl p-10 flex flex-col items-center justify-center bg-primary/5 group hover:border-primary/40 transition-colors cursor-pointer">
                                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                                    <FileUp className="h-8 w-8" />
                                </div>
                                <p className="text-sm font-bold text-foreground">Click or drag files to upload</p>
                                <p className="text-xs text-muted-foreground mt-1">Support for FAQ documents, medical guidelines, and chat logs.</p>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-sm">Recently Uploaded</h3>
                                {[
                                    { name: "faq_v2_2026.pdf", size: "2.4 MB", date: "2 hours ago", status: "Processed" },
                                    { name: "cardiology_slots.json", size: "45 KB", date: "1 day ago", status: "Indexed" },
                                ].map(file => (
                                    <div key={file.name} className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-transparent hover:border-primary/10 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-card flex items-center justify-center">
                                                <FileUp className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold leading-tight">{file.name}</p>
                                                <p className="text-[10px] text-muted-foreground">{file.size} • {file.date}</p>
                                            </div>
                                        </div>
                                        <Badge variant="success" className="text-[10px]">{file.status}</Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-card/60">
                        <CardHeader>
                            <CardTitle className="text-xl">Add Manual Training Data</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground pl-1">Question / Intent</label>
                                    <Input placeholder="How do I book a neurologist?" className="bg-muted/50 border-none h-11" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground pl-1">Category</label>
                                    <Input placeholder="Appointments" className="bg-muted/50 border-none h-11" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground pl-1">AI Response</label>
                                <textarea
                                    className="w-full h-32 bg-muted/50 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Type the expected AI response here..."
                                />
                            </div>
                            <Button className="w-full h-11 shadow-lg shadow-blue-100">Add to Training Set</Button>
                        </CardContent>
                    </Card>
                </div>

                {/* AI Metrics Sidebar */}
                <div className="space-y-6">
                    <Card className="border-none shadow-sm bg-primary text-primary-foreground overflow-hidden">
                        <CardHeader>
                            <CardTitle className="text-lg">AI Performance</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 relative">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Settings2 className="h-20 w-20" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold uppercase">
                                    <span>Accuracy</span>
                                    <span>98.2%</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-white rounded-full" style={{ width: "98.2%" }} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold uppercase">
                                    <span>Response Time</span>
                                    <span>1.2s</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-white rounded-full" style={{ width: "85%" }} />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-white/10 flex justify-between items-center capitalize">
                                <div className="text-center flex-1 border-r border-white/10">
                                    <p className="text-xl font-bold">12k</p>
                                    <p className="text-[10px] font-medium opacity-80">Queries</p>
                                </div>
                                <div className="text-center flex-1">
                                    <p className="text-xl font-bold">96%</p>
                                    <p className="text-[10px] font-medium opacity-80">Sat. Rate</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-card/60">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <History className="h-4 w-4 text-primary" />
                                Training History
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[
                                { title: "MedTerm Dataset", status: "Success", time: "18h ago" },
                                { title: "Staff Schedule Sync", status: "Success", time: "2d ago" },
                                { title: "Patient FAQ V1", status: "Failed", time: "3d ago" },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        {item.status === "Success" ? (
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                        ) : (
                                            <AlertCircle className="h-4 w-4 text-destructive" />
                                        )}
                                        <span className="text-xs font-bold truncate">{item.title}</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{item.time}</span>
                                </div>
                            ))}
                            <Button variant="ghost" className="w-full text-xs font-bold mt-2 h-8">View logs</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
