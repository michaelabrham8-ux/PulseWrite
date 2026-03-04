import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
    Card, CardHeader, CardTitle, CardDescription,
    CardContent, CardFooter,
} from "@/components/ui/card";
import {
    Sparkles, Zap, PenLine, ChevronRight,
    Lightbulb, Copy, CheckCheck, RotateCcw,
    Loader2, ArrowLeft, Crown, Settings, AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode = "ideas" | "write";
type View = "home" | "results-ideas" | "results-post" | "settings";
type Tone = "professional" | "casual" | "inspirational" | "savage";
type Length = "short" | "medium" | "thread";

interface PostIdea { title: string; angle: string; }
interface GeneratedPost { content: string; characterCount: number; estimatedReadTime: number; }

const TONES: { value: Tone; label: string; emoji: string }[] = [
    { value: "professional", label: "Pro", emoji: "💼" },
    { value: "casual", label: "Casual", emoji: "😊" },
    { value: "inspirational", label: "Inspire", emoji: "🔥" },
    { value: "savage", label: "Savage", emoji: "😈" },
];

const LENGTHS: { value: Length; label: string; sub: string }[] = [
    { value: "short", label: "Short", sub: "~150 chars" },
    { value: "medium", label: "Medium", sub: "~400 chars" },
    { value: "thread", label: "Thread", sub: "3 parts" },
];

// ─── Message helper ───────────────────────────────────────────────────────────
function sendMsg<T>(msg: Record<string, unknown>): Promise<T> {
    return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
    const [mode, setMode] = useState<Mode>("ideas");
    const [view, setView] = useState<View>("home");
    const [topic, setTopic] = useState("");
    const [tone, setTone] = useState<Tone>("professional");
    const [length, setLength] = useState<Length>("medium");
    const [apiKeyInput, setApiKeyInput] = useState("");
    const [apiKeySaved, setApiKeySaved] = useState(false);

    const [ideas, setIdeas] = useState<PostIdea[]>([]);
    const [post, setPost] = useState<GeneratedPost | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const [inserted, setInserted] = useState(false);

    const [used, setUsed] = useState(0);
    const [limit, setLimit] = useState(10);
    const [activeTabId, setActiveTabId] = useState<number | null>(null);

    // ── Boot ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        sendMsg<{ used: number; limit: number }>({ type: "GET_USAGE" }).then((r) => {
            if (r) { setUsed(r.used); setLimit(r.limit); }
        });
        chrome.storage.local.get("pw_groq_api_key", (r) => {
            if (r.pw_groq_api_key) setApiKeySaved(true);
        });
        sendMsg<{ tabId: number | null }>({ type: "GET_ACTIVE_TAB" }).then((r) => {
            if (r?.tabId) setActiveTabId(r.tabId);
        });
    }, []);

    const remaining = limit - used;

    // ── Error helpers ─────────────────────────────────────────────────────────
    const handleApiError = useCallback((errCode: string) => {
        if (errCode === "NO_API_KEY") {
            setError("No API key found. Add your Groq key in Settings.");
            setView("settings");
        } else if (errCode === "LIMIT_REACHED") {
            setError("Monthly limit reached — upgrade to Pro for unlimited!");
        } else {
            setError("Groq API error. Check your key in Settings and try again.");
        }
    }, []);

    // ── Generate Ideas ────────────────────────────────────────────────────────
    const handleGenerateIdeas = useCallback(async () => {
        setError("");
        setLoading(true);
        try {
            const res = await sendMsg<{ ideas?: PostIdea[]; used?: number; error?: string }>(
                { type: "GENERATE_IDEAS", tone }
            );
            if (res?.error) { handleApiError(res.error); return; }
            if (res?.ideas) {
                setIdeas(res.ideas);
                if (res.used !== undefined) setUsed(res.used);
                setView("results-ideas");
            }
        } finally {
            setLoading(false);
        }
    }, [tone, handleApiError]);

    // ── Ghostwrite ────────────────────────────────────────────────────────────
    const handleGhostwrite = useCallback(async (overrideTopic?: string) => {
        const t = overrideTopic ?? topic;
        if (!t.trim()) { setError("Enter a topic first!"); return; }
        setError("");
        setLoading(true);
        setPost(null);
        try {
            const res = await sendMsg<{ post?: GeneratedPost; used?: number; error?: string }>(
                { type: "GHOSTWRITE", topic: t, tone, length }
            );
            if (res?.error) { handleApiError(res.error); return; }
            if (res?.post) {
                setPost(res.post);
                if (res.used !== undefined) setUsed(res.used);
                setView("results-post");
            }
        } finally {
            setLoading(false);
        }
    }, [topic, tone, length, handleApiError]);

    // ── Copy ──────────────────────────────────────────────────────────────────
    const handleCopy = () => {
        if (!post) return;
        navigator.clipboard.writeText(post.content).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    // ── Insert into LinkedIn ──────────────────────────────────────────────────
    const handleInsert = useCallback(async () => {
        if (!post) return;
        const res = await sendMsg<{ ok?: boolean; error?: string }>({
            type: "INSERT_TEXT", text: post.content, tabId: activeTabId,
        });
        if (res?.ok) {
            setInserted(true);
            setTimeout(() => setInserted(false), 2500);
        } else {
            setError("Could not insert — click the compose box first, then retry.");
        }
    }, [post, activeTabId]);

    // ── Save API key ──────────────────────────────────────────────────────────
    const handleSaveKey = () => {
        if (!apiKeyInput.trim()) return;
        sendMsg({ type: "SAVE_API_KEY", key: apiKeyInput.trim() }).then(() => {
            setApiKeySaved(true);
            setApiKeyInput("");
            setError("");
            setView("home");
        });
    };

    const goHome = () => { setView("home"); setError(""); setLoading(false); };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-[540px] bg-(--pw-bg-dark)">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <header className="flex items-center gap-3 px-5 py-3 border-b border-(--pw-border)">
                {view !== "home" && (
                    <button
                        onClick={goHome}
                        className="flex items-center justify-center w-7 h-7 rounded-lg border border-(--pw-border) bg-(--pw-bg-input) text-(--pw-text-muted) hover:text-(--pw-text) transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                )}
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-(--pw-primary) pulse-glow shrink-0">
                    <PenLine className="w-4 h-4 text-white" />
                </div>
                <div>
                    <h1 className="text-sm font-bold text-(--pw-text) tracking-tight">PulseWrite</h1>
                    <p className="text-[10px] text-(--pw-text-muted)">LinkedIn Ghostwriter</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-(--pw-bg-input) border border-(--pw-border)">
                        <Zap className="w-2.5 h-2.5 text-(--pw-accent)" />
                        <span className="text-[9px] text-(--pw-text-muted)">{remaining}/{limit} left</span>
                    </div>
                    <button
                        onClick={() => setView("settings")}
                        className="flex items-center justify-center w-7 h-7 rounded-lg border border-(--pw-border) bg-(--pw-bg-input) text-(--pw-text-muted) hover:text-(--pw-text) transition-colors"
                        title="Settings"
                    >
                        <Settings className="w-3.5 h-3.5" />
                    </button>
                </div>
            </header>

            {/* ── Error bar ──────────────────────────────────────────────── */}
            {error && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-[11px]">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* ── HOME ───────────────────────────────────────────────────── */}
            {view === "home" && (
                <main className="flex-1 overflow-y-auto p-4 space-y-3">

                    {/* Mode tabs */}
                    <div className="grid grid-cols-2 gap-2">
                        {(["ideas", "write"] as Mode[]).map((m) => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold border transition-all ${mode === m
                                        ? "bg-(--pw-primary)/20 border-(--pw-primary)/40 text-(--pw-primary-h)"
                                        : "bg-(--pw-bg-input) border-(--pw-border) text-(--pw-text-muted) hover:text-(--pw-text)"
                                    }`}
                            >
                                {m === "ideas" ? <Lightbulb className="w-3.5 h-3.5" /> : <PenLine className="w-3.5 h-3.5" />}
                                {m === "ideas" ? "Generate Ideas" : "Write Post"}
                            </button>
                        ))}
                    </div>

                    {/* Tone selector */}
                    <div className="grid grid-cols-4 gap-1.5">
                        {TONES.map((t) => (
                            <button
                                key={t.value}
                                onClick={() => setTone(t.value)}
                                className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] border transition-all ${tone === t.value
                                        ? "bg-(--pw-primary)/15 border-(--pw-primary)/45 text-(--pw-primary-h) font-semibold"
                                        : "bg-(--pw-bg-input) border-(--pw-border) text-(--pw-text-muted) hover:text-(--pw-text)"
                                    }`}
                            >
                                <span className="text-base leading-none">{t.emoji}</span>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Topic input (write mode) */}
                    {mode === "write" && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-xs">
                                    <PenLine className="w-3.5 h-3.5 text-(--pw-accent)" />
                                    Topic / rough draft
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <textarea
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="e.g. Why I quit my corporate job to build in public…"
                                    className="w-full h-20 px-3 py-2 rounded-lg bg-(--pw-bg-input) border border-(--pw-border) text-xs text-(--pw-text) placeholder:text-(--pw-text-muted) resize-none focus:outline-none focus:border-(--pw-primary) focus:ring-1 focus:ring-(--pw-glow) transition-all"
                                />
                                {/* Length selector */}
                                <div className="grid grid-cols-3 gap-1.5 mt-2">
                                    {LENGTHS.map((l) => (
                                        <button key={l.value} onClick={() => setLength(l.value)}
                                            className={`flex flex-col items-center py-1.5 rounded-lg text-[9px] border transition-all ${length === l.value
                                                    ? "bg-(--pw-primary)/15 border-(--pw-primary)/45 text-(--pw-primary-h) font-semibold"
                                                    : "bg-(--pw-bg-input) border-(--pw-border) text-(--pw-text-muted)"
                                                }`}>
                                            <span className="font-semibold text-[10px]">{l.label}</span>
                                            <span className="opacity-60">{l.sub}</span>
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Generate button */}
                    <Button
                        className="w-full group"
                        size="lg"
                        disabled={loading || remaining <= 0 || (mode === "write" && !topic.trim())}
                        onClick={mode === "ideas" ? handleGenerateIdeas : () => handleGhostwrite()}
                    >
                        {loading
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                            : mode === "ideas"
                                ? <><Lightbulb className="w-4 h-4" /> Generate 5 Ideas <ChevronRight className="w-4 h-4 ml-auto opacity-50 transition-transform group-hover:translate-x-0.5" /></>
                                : <><Sparkles className="w-4 h-4" /> Write My Post <ChevronRight className="w-4 h-4 ml-auto opacity-50 transition-transform group-hover:translate-x-0.5" /></>
                        }
                    </Button>

                    {remaining <= 0 && (
                        <p className="text-center text-[10px] text-(--pw-text-muted)">
                            Monthly limit reached.{" "}
                            <a href="https://pulsewrite.io/upgrade" target="_blank" rel="noreferrer"
                                className="text-(--pw-primary-h) font-semibold hover:opacity-80">
                                Upgrade to Pro →
                            </a>
                        </p>
                    )}

                    {/* Empty state */}
                    {!loading && (
                        <Card className="border-dashed">
                            <CardContent className="py-6 flex flex-col items-center text-center">
                                <div className="w-10 h-10 rounded-full bg-(--pw-bg-input) flex items-center justify-center mb-2">
                                    <Sparkles className="w-5 h-5 text-(--pw-text-muted)" />
                                </div>
                                <p className="text-xs font-medium text-(--pw-text-muted)">
                                    {mode === "ideas" ? "5 post ideas will appear here" : "Your generated post will appear here"}
                                </p>
                                <p className="text-[10px] text-(--pw-text-muted) mt-1 opacity-50">
                                    Powered by Llama 3.1 via Groq
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </main>
            )}

            {/* ── IDEAS RESULTS ───────────────────────────────────────────── */}
            {view === "results-ideas" && (
                <main className="flex-1 overflow-y-auto p-4 space-y-2">
                    <p className="text-[10px] font-semibold text-(--pw-text-muted) uppercase tracking-wider flex items-center gap-1.5 mb-1">
                        <Lightbulb className="w-3 h-3" /> 5 Ideas for you
                    </p>
                    {ideas.map((idea, i) => (
                        <button
                            key={i}
                            onClick={() => { setTopic(idea.title + " — " + idea.angle); setMode("write"); setView("home"); }}
                            className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-(--pw-border) bg-(--pw-bg-input) hover:bg-(--pw-bg-hover) hover:border-(--pw-primary)/40 transition-all"
                        >
                            <span className="shrink-0 w-5 h-5 rounded-md bg-(--pw-primary)/15 border border-(--pw-primary)/25 flex items-center justify-center text-[9px] font-bold text-(--pw-primary-h)">
                                {i + 1}
                            </span>
                            <div className="min-w-0">
                                <p className="text-[11.5px] font-semibold text-(--pw-text) truncate">{idea.title}</p>
                                <p className="text-[10px] text-(--pw-text-muted) mt-0.5 truncate">{idea.angle}</p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-(--pw-text-muted) shrink-0 mt-0.5" />
                        </button>
                    ))}
                </main>
            )}

            {/* ── POST RESULT ─────────────────────────────────────────────── */}
            {view === "results-post" && post && (
                <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                    {/* Meta */}
                    <div className="flex items-center gap-2 text-[10px] text-(--pw-text-muted)">
                        <span>{post.characterCount} chars</span>
                        <span>·</span>
                        <span>~{post.estimatedReadTime}s read</span>
                        <span>·</span>
                        <span className={post.characterCount > 3000 ? "text-red-400" : "text-(--pw-success)"}>
                            {post.characterCount > 3000 ? "⚠ Over LinkedIn limit" : "✓ Within limit"}
                        </span>
                    </div>

                    {/* Post text */}
                    <Card className="flex-1">
                        <CardContent className="py-3 px-4 overflow-y-auto max-h-[260px]">
                            {post.content.split("---PART---").map((part, i) => (
                                <div key={i}>
                                    {i > 0 && <p className="text-center text-[9px] text-(--pw-text-muted) my-2 opacity-60">— Part {i + 1} —</p>}
                                    <pre className="text-[11.5px] text-(--pw-text) whitespace-pre-wrap leading-relaxed font-sans">{part.trim()}</pre>
                                </div>
                            ))}
                        </CardContent>
                        <CardFooter className="pt-0 pb-3 gap-2">
                            <Button variant="secondary" size="sm" className="flex-1" onClick={handleCopy}>
                                {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                {copied ? "Copied!" : "Copy"}
                            </Button>
                            <Button size="sm" className="flex-1" onClick={handleInsert}>
                                {inserted ? <CheckCheck className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                                {inserted ? "Inserted!" : "Insert into LinkedIn"}
                            </Button>
                        </CardFooter>
                    </Card>

                    <button
                        onClick={() => handleGhostwrite()}
                        disabled={loading}
                        className="flex items-center justify-center gap-1.5 text-[10px] text-(--pw-text-muted) hover:text-(--pw-text) transition-colors"
                    >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                        Regenerate
                    </button>
                </main>
            )}

            {/* ── SETTINGS ────────────────────────────────────────────────── */}
            {view === "settings" && (
                <main className="flex-1 overflow-y-auto p-4 space-y-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs flex items-center gap-2">
                                <Settings className="w-3.5 h-3.5 text-(--pw-accent)" />
                                Groq API Key
                                {apiKeySaved && <span className="text-(--pw-success) font-normal text-[10px]">✓ Saved</span>}
                            </CardTitle>
                            <CardDescription className="text-[10px]">
                                Free at{" "}
                                <a href="https://console.groq.com" target="_blank" rel="noreferrer"
                                    className="text-(--pw-primary-h) underline">console.groq.com</a>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <input
                                type="password"
                                className="w-full px-3 py-2 rounded-lg bg-(--pw-bg-input) border border-(--pw-border) text-xs text-(--pw-text) placeholder:text-(--pw-text-muted) focus:outline-none focus:border-(--pw-primary) focus:ring-1 focus:ring-(--pw-glow) transition-all"
                                placeholder={apiKeySaved ? "gsk_••••••••••••••••" : "gsk_..."}
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                            />
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" size="sm" onClick={handleSaveKey} disabled={!apiKeyInput.trim()}>
                                Save API Key
                            </Button>
                        </CardFooter>
                    </Card>

                    {/* Pro upgrade */}
                    <Card className="border-(--pw-primary)/20 bg-(--pw-primary)/5">
                        <CardContent className="py-5 flex flex-col items-center text-center gap-2">
                            <Crown className="w-6 h-6 text-yellow-400" />
                            <p className="text-sm font-bold text-(--pw-text)">Upgrade to Pro</p>
                            <p className="text-[10px] text-(--pw-text-muted) leading-relaxed">
                                Unlimited generations · Priority model · Saved tone templates
                            </p>
                            <a
                                href="https://pulsewrite.io/upgrade"
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-(--pw-primary) text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                            >
                                Go Pro – $9.99/mo
                            </a>
                        </CardContent>
                    </Card>
                </main>
            )}

            {/* ── Footer ──────────────────────────────────────────────────── */}
            <footer className="px-5 py-2.5 border-t border-(--pw-border) flex items-center justify-between">
                <span className="text-[9.5px] text-(--pw-text-muted) opacity-50">PulseWrite © 2026</span>
                <button
                    onClick={() => setView("settings")}
                    className="text-[9.5px] text-(--pw-text-muted) hover:text-(--pw-text) transition-colors flex items-center gap-1"
                >
                    ⚙️ Settings
                </button>
            </footer>
        </div>
    );
}

export default App;
