/**
 * PulseWrite Popup – Day 3
 * Full Generate Ideas + Write Post flows with Groq integration,
 * usage tracking, and insert-into-LinkedIn.
 */
import { useState, useEffect, useCallback } from "react";
import {
    Sparkles, PenLine, ChevronRight, Zap, Crown,
    RotateCcw, Lightbulb, Copy, CheckCheck, ArrowLeft,
    AlertCircle, Settings, Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = "home" | "ideas" | "write" | "result" | "settings";
type Tone = "professional" | "casual" | "inspirational" | "savage" | "humorous" | "thought-leadership";
type PostLength = "short" | "medium" | "thread";

interface PostIdea { title: string; angle: string; }
interface GeneratedPost { content: string; characterCount: number; estimatedReadTime: number; }

const TONES: { value: Tone; label: string; emoji: string }[] = [
    { value: "professional", label: "Pro", emoji: "💼" },
    { value: "casual", label: "Casual", emoji: "😊" },
    { value: "inspirational", label: "Inspire", emoji: "🔥" },
    { value: "thought-leadership", label: "Expert", emoji: "🧠" },
    { value: "humorous", label: "Funny", emoji: "😄" },
    { value: "savage", label: "Savage", emoji: "😈" },
];

const LENGTHS: { value: PostLength; label: string; sub: string }[] = [
    { value: "short", label: "Short", sub: "~150 chars" },
    { value: "medium", label: "Medium", sub: "~400 chars" },
    { value: "thread", label: "Thread", sub: "3 parts" },
];

// ─── Msg helpers ──────────────────────────────────────────────────────────────
function sendMsg<T>(msg: Record<string, unknown>): Promise<T> {
    return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ type, msg }: { type: "error" | "success"; msg: string }) {
    return (
        <div className={`toast toast-${type}`}>
            {type === "error" ? <AlertCircle size={13} /> : <CheckCheck size={13} />}
            {msg}
        </div>
    );
}

// ─── Usage bar ────────────────────────────────────────────────────────────────
function UsageBar({ used, limit }: { used: number; limit: number }) {
    const remaining = limit - used;
    const pct = Math.min((used / limit) * 100, 100);
    return (
        <div className="gen-bar">
            <div className="gen-bar-track">
                <div className="gen-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="gen-bar-label">{remaining}/{limit} left</span>
        </div>
    );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
    // ── State ─────────────────────────────────────────────────────────────────
    const [screen, setScreen] = useState<Screen>("home");
    const [tone, setTone] = useState<Tone>("professional");
    const [length, setLength] = useState<PostLength>("medium");
    const [topic, setTopic] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [apiKeyInput, setApiKeyInput] = useState("");

    const [ideas, setIdeas] = useState<PostIdea[]>([]);
    const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ type: "error" | "success"; msg: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const [inserted, setInserted] = useState(false);

    const [used, setUsed] = useState(0);
    const [limit, setLimit] = useState(10);
    const [activeTabId, setActiveTabId] = useState<number | null>(null);

    // ── Boot ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        // Load usage
        sendMsg<{ used: number; limit: number }>({ type: "GET_USAGE" }).then((r) => {
            if (r) { setUsed(r.used); setLimit(r.limit); }
        });
        // Load stored API key
        chrome.storage.local.get("pw_groq_api_key", (r) => {
            if (r.pw_groq_api_key) setApiKey(r.pw_groq_api_key as string);
        });
        // Get active compose tab
        sendMsg<{ tabId: number | null }>({ type: "GET_ACTIVE_TAB" }).then((r) => {
            if (r?.tabId) setActiveTabId(r.tabId);
        });
    }, []);

    // ── Toast auto-dismiss ────────────────────────────────────────────────────
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    // ── Error handler ─────────────────────────────────────────────────────────
    const handleError = useCallback((errCode: string) => {
        if (errCode === "NO_API_KEY") {
            setToast({ type: "error", msg: "Add your Groq API key in Settings ⚙️" });
            setScreen("settings");
        } else if (errCode === "LIMIT_REACHED") {
            setToast({ type: "error", msg: "Monthly limit reached. Upgrade to Pro!" });
        } else {
            setToast({ type: "error", msg: "Groq API error. Check your key & try again." });
        }
    }, []);

    // ── Generate Ideas ────────────────────────────────────────────────────────
    const handleGenerateIdeas = useCallback(async () => {
        if (!apiKey) { handleError("NO_API_KEY"); return; }
        setLoading(true);
        setIdeas([]);
        try {
            const res = await sendMsg<{
                ideas?: PostIdea[];
                used?: number; remaining?: number;
                error?: string;
            }>({ type: "GENERATE_IDEAS", tone });

            if (res?.error) { handleError(res.error); return; }
            if (res?.ideas) {
                setIdeas(res.ideas);
                if (res.used !== undefined) setUsed(res.used);
                setScreen("ideas");
            }
        } finally {
            setLoading(false);
        }
    }, [apiKey, tone, handleError]);

    // ── Ghostwrite ────────────────────────────────────────────────────────────
    const handleGhostwrite = useCallback(async (overrideTopic?: string) => {
        const t = overrideTopic ?? topic;
        if (!t.trim()) { setToast({ type: "error", msg: "Enter a topic first!" }); return; }
        if (!apiKey) { handleError("NO_API_KEY"); return; }
        setLoading(true);
        setGeneratedPost(null);
        try {
            const res = await sendMsg<{
                post?: GeneratedPost;
                used?: number;
                error?: string;
            }>({ type: "GHOSTWRITE", topic: t, tone, length });

            if (res?.error) { handleError(res.error); return; }
            if (res?.post) {
                setGeneratedPost(res.post);
                if (res.used !== undefined) setUsed(res.used);
                setScreen("result");
            }
        } finally {
            setLoading(false);
        }
    }, [topic, tone, length, apiKey, handleError]);

    // ── Copy to clipboard ─────────────────────────────────────────────────────
    const handleCopy = () => {
        if (!generatedPost) return;
        navigator.clipboard.writeText(generatedPost.content).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    // ── Insert into LinkedIn ──────────────────────────────────────────────────
    const handleInsert = useCallback(async () => {
        if (!generatedPost) return;
        const res = await sendMsg<{ ok?: boolean; error?: string }>({
            type: "INSERT_TEXT",
            text: generatedPost.content,
            tabId: activeTabId,
        });
        if (res?.ok) {
            setInserted(true);
            setToast({ type: "success", msg: "Inserted into LinkedIn ✓" });
            setTimeout(() => setInserted(false), 2500);
        } else {
            setToast({ type: "error", msg: "Could not insert — click compose box first and retry." });
        }
    }, [generatedPost, activeTabId]);

    // ── Save API key ──────────────────────────────────────────────────────────
    const handleSaveKey = () => {
        if (!apiKeyInput.trim()) return;
        sendMsg({ type: "SAVE_API_KEY", key: apiKeyInput.trim() }).then(() => {
            setApiKey(apiKeyInput.trim());
            setToast({ type: "success", msg: "API key saved!" });
            setScreen("home");
        });
    };

    // ── Render ────────────────────────────────────────────────────────────────
    const remaining = limit - used;

    return (
        <div className="popup-root">
            {/* Toast */}
            {toast && <Toast {...toast} />}

            {/* Header */}
            <header className="header">
                {screen !== "home" && (
                    <button className="back-btn" onClick={() => {
                        setScreen("home");
                        setLoading(false);
                        setGeneratedPost(null);
                    }}>
                        <ArrowLeft size={15} />
                    </button>
                )}
                <div className="logo-icon pulse-glow"><PenLine size={17} strokeWidth={2.5} /></div>
                <div className="header-text">
                    <h1>PulseWrite</h1>
                    <span>LinkedIn Ghostwriter</span>
                </div>
                <div className="header-right">
                    <div className="badge-free"><Zap size={9} /> Free</div>
                    <button className="icon-btn" onClick={() => setScreen("settings")} title="Settings">
                        <Settings size={14} />
                    </button>
                </div>
            </header>

            {/* Usage bar */}
            <UsageBar used={used} limit={limit} />

            {/* ── HOME ──────────────────────────────────────────────────────── */}
            {screen === "home" && (
                <main className="main-content">
                    {/* Hero */}
                    <div className="hero">
                        <div className="hero-icon"><Sparkles size={28} /></div>
                        <p className="hero-title">Write smarter on LinkedIn</p>
                        <p className="hero-sub">AI-powered posts in your voice, in seconds.</p>
                    </div>

                    {/* Tone picker */}
                    <div className="field">
                        <label className="field-label">Tone</label>
                        <div className="tone-grid">
                            {TONES.map(t => (
                                <button key={t.value}
                                    className={`tone-btn ${tone === t.value ? "active" : ""}`}
                                    onClick={() => setTone(t.value)}>
                                    <span className="tone-emoji">{t.emoji}</span>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="action-grid">
                        <button
                            className="action-btn ideas-btn"
                            onClick={handleGenerateIdeas}
                            disabled={loading || remaining <= 0}
                        >
                            {loading ? <Loader2 size={18} className="spin" /> : <Lightbulb size={18} />}
                            <span>Generate Ideas</span>
                            <span className="action-sub">5 post concepts</span>
                        </button>
                        <button
                            className="action-btn write-btn"
                            onClick={() => setScreen("write")}
                            disabled={remaining <= 0}
                        >
                            <PenLine size={18} />
                            <span>Write Post</span>
                            <span className="action-sub">From a topic</span>
                        </button>
                    </div>

                    {remaining <= 0 && (
                        <div className="limit-banner">
                            <Crown size={13} />
                            <span>Monthly limit reached. <a href="https://pulsewrite.io/upgrade" target="_blank" rel="noreferrer" className="upgrade-link">Upgrade to Pro →</a></span>
                        </div>
                    )}
                </main>
            )}

            {/* ── IDEAS ─────────────────────────────────────────────────────── */}
            {screen === "ideas" && (
                <main className="main-content">
                    <p className="section-title"><Lightbulb size={13} /> 5 Ideas for you</p>
                    <div className="ideas-list">
                        {ideas.map((idea, i) => (
                            <button
                                key={i}
                                className="idea-card"
                                onClick={() => {
                                    setTopic(idea.title + " — " + idea.angle);
                                    setScreen("write");
                                }}
                            >
                                <div className="idea-num">{i + 1}</div>
                                <div className="idea-body">
                                    <p className="idea-title">{idea.title}</p>
                                    <p className="idea-angle">{idea.angle}</p>
                                </div>
                                <ChevronRight size={13} className="idea-arrow" />
                            </button>
                        ))}
                    </div>
                </main>
            )}

            {/* ── WRITE POST ────────────────────────────────────────────────── */}
            {screen === "write" && (
                <main className="main-content">
                    <div className="field">
                        <label className="field-label">Topic / rough draft</label>
                        <textarea
                            className="field-input"
                            value={topic}
                            onChange={e => setTopic(e.target.value)}
                            placeholder="e.g. Why I quit my corporate job to build in public…"
                            rows={4}
                            autoFocus
                        />
                    </div>

                    <div className="field">
                        <label className="field-label">Tone</label>
                        <div className="tone-grid">
                            {TONES.map(t => (
                                <button key={t.value}
                                    className={`tone-btn ${tone === t.value ? "active" : ""}`}
                                    onClick={() => setTone(t.value)}>
                                    <span className="tone-emoji">{t.emoji}</span>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="field">
                        <label className="field-label">Length</label>
                        <div className="length-grid">
                            {LENGTHS.map(l => (
                                <button key={l.value}
                                    className={`length-btn ${length === l.value ? "active" : ""}`}
                                    onClick={() => setLength(l.value)}>
                                    <span className="length-label">{l.label}</span>
                                    <span className="length-sub">{l.sub}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        className="cta-btn"
                        onClick={() => handleGhostwrite()}
                        disabled={loading || !topic.trim() || remaining <= 0}
                    >
                        {loading
                            ? <><Loader2 size={15} className="spin" /> Writing…</>
                            : <><Sparkles size={15} /> Write My Post <ChevronRight size={13} className="cta-arrow" /></>
                        }
                    </button>
                </main>
            )}

            {/* ── RESULT ────────────────────────────────────────────────────── */}
            {screen === "result" && generatedPost && (
                <main className="main-content">
                    {/* Meta */}
                    <div className="result-meta">
                        <span>{generatedPost.characterCount} chars</span>
                        <span>·</span>
                        <span>~{generatedPost.estimatedReadTime}s read</span>
                        <span>·</span>
                        <span className={generatedPost.characterCount > 3000 ? "over-limit" : "ok-limit"}>
                            {generatedPost.characterCount > 3000 ? "⚠ LinkedIn max is 3,000" : "✓ Within limit"}
                        </span>
                    </div>

                    {/* Post text */}
                    <div className="result-box">
                        {generatedPost.content.split("---PART---").map((part, i) => (
                            <div key={i} className={i > 0 ? "thread-part" : ""}>
                                {i > 0 && <div className="thread-divider">— Part {i + 1} —</div>}
                                <pre className="result-text">{part.trim()}</pre>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="result-actions">
                        <button className="result-btn copy-btn" onClick={handleCopy}>
                            {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
                            {copied ? "Copied!" : "Copy"}
                        </button>
                        <button className="result-btn insert-btn" onClick={handleInsert}>
                            {inserted ? <CheckCheck size={14} /> : <Zap size={14} />}
                            {inserted ? "Inserted!" : "Insert into LinkedIn"}
                        </button>
                    </div>

                    <button className="regen-btn" onClick={() => handleGhostwrite()} disabled={loading}>
                        {loading ? <Loader2 size={12} className="spin" /> : <RotateCcw size={12} />}
                        Regenerate
                    </button>
                </main>
            )}

            {/* ── SETTINGS ──────────────────────────────────────────────────── */}
            {screen === "settings" && (
                <main className="main-content">
                    <p className="section-title"><Settings size={13} /> Settings</p>

                    <div className="field">
                        <label className="field-label">
                            Groq API Key
                            {apiKey && <span className="key-saved"> ✓ Saved</span>}
                        </label>
                        <p className="field-hint">
                            Get a free key at <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="upgrade-link">console.groq.com</a>
                        </p>
                        <input
                            className="field-input"
                            type="password"
                            placeholder={apiKey ? "gsk_••••••••••••••••••••" : "gsk_..."}
                            value={apiKeyInput}
                            onChange={e => setApiKeyInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSaveKey()}
                        />
                    </div>

                    <button className="cta-btn" onClick={handleSaveKey} disabled={!apiKeyInput.trim()}>
                        Save API Key
                    </button>

                    <div className="settings-divider" />

                    <div className="upgrade-card">
                        <Crown size={20} className="upgrade-crown" />
                        <p className="upgrade-title">Upgrade to Pro</p>
                        <p className="upgrade-sub">Unlimited generations + priority Groq model + saved tone templates</p>
                        <a
                            href="https://pulsewrite.io/upgrade"
                            target="_blank"
                            rel="noreferrer"
                            className="cta-btn upgrade-cta"
                        >
                            Go Pro – $9.99/mo
                        </a>
                    </div>
                </main>
            )}

            {/* Footer */}
            <footer className="footer">
                <span className="footer-copy">PulseWrite © 2026</span>
                <button className="footer-link" onClick={() => setScreen("settings")}>
                    <Settings size={10} /> Settings
                </button>
            </footer>
        </div>
    );
}
