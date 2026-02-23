import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@/components/ui/card";
import { Sparkles, Zap, PenLine, ChevronRight } from "lucide-react";

function App() {
    const [topic, setTopic] = useState("");

    return (
        <div className="flex flex-col h-[520px] bg-(--pw-bg-dark)">
            {/* Header */}
            <header className="flex items-center gap-3 px-5 py-4 border-b border-(--pw-border)">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-(--pw-primary) pulse-glow">
                    <PenLine className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-base font-bold text-(--pw-text) tracking-tight">
                        PulseWrite
                    </h1>
                    <p className="text-[11px] text-(--pw-text-muted)">
                        LinkedIn Ghostwriter
                    </p>
                </div>
                <div className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-(--pw-bg-input) border border-(--pw-border)">
                    <div className="w-1.5 h-1.5 rounded-full bg-(--pw-success)" />
                    <span className="text-[10px] text-(--pw-text-muted)">v0.1.0</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Topic Input Card */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <Sparkles className="w-4 h-4 text-(--pw-accent)" />
                            What's on your mind?
                        </CardTitle>
                        <CardDescription>
                            Enter a topic or theme for your LinkedIn post
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <textarea
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g., AI trends in 2025, leadership lessons, startup growth..."
                            className="w-full h-24 px-3 py-2.5 rounded-lg bg-(--pw-bg-input) border border-(--pw-border) text-sm text-(--pw-text) placeholder:text-(--pw-text-muted) resize-none focus:outline-none focus:border-(--pw-primary) focus:ring-1 focus:ring-(--pw-glow) transition-all duration-200"
                        />
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full group" size="lg">
                            <Zap className="w-4 h-4 transition-transform group-hover:scale-110" />
                            Generate Ideas
                            <ChevronRight className="w-4 h-4 ml-auto opacity-50 transition-transform group-hover:translate-x-0.5" />
                        </Button>
                    </CardFooter>
                </Card>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" size="sm" className="justify-start">
                        <Sparkles className="w-3.5 h-3.5 text-(--pw-accent)" />
                        Trending Topics
                    </Button>
                    <Button variant="secondary" size="sm" className="justify-start">
                        <PenLine className="w-3.5 h-3.5 text-(--pw-accent)" />
                        Draft from Scratch
                    </Button>
                </div>

                {/* Empty State */}
                <Card className="border-dashed">
                    <CardContent className="py-8 flex flex-col items-center text-center">
                        <div className="w-12 h-12 rounded-full bg-(--pw-bg-input) flex items-center justify-center mb-3">
                            <PenLine className="w-6 h-6 text-(--pw-text-muted)" />
                        </div>
                        <p className="text-sm font-medium text-(--pw-text-muted)">
                            Your generated ideas will appear here
                        </p>
                        <p className="text-xs text-(--pw-text-muted) mt-1 opacity-60">
                            Powered by Llama 3.1 via Groq
                        </p>
                    </CardContent>
                </Card>
            </main>

            {/* Footer */}
            <footer className="px-5 py-3 border-t border-(--pw-border) flex items-center justify-between">
                <span className="text-[10px] text-(--pw-text-muted) opacity-50">
                    PulseWrite © 2026
                </span>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2">
                    ⚙️ Settings
                </Button>
            </footer>
        </div>
    );
}

export default App;
