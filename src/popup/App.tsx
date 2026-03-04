import { useState } from "react";
import { Sparkles, PenLine, ChevronRight, Zap, Crown, RotateCcw, Lightbulb } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode = "ideas" | "write";
type Tone = "professional" | "casual" | "inspirational" | "savage";
type Length = "short" | "medium" | "thread";

const TONES: { value: Tone; label: string; emoji: string }[] = [
    { value: "professional", label: "Pro", emoji: "💼" },
    { value: "casual", label: "Casual", emoji: "😊" },
    { value: "inspirational", label: "Inspire", emoji: "🔥" },
    { value: "savage", label: "Savage", emoji: "😈" },
];

const LENGTHS: { value: Length; label: string; sub: string }[] = [
    { value: "short", label: "Short", sub: "~100 words" },
    { value: "medium", label: "Medium", sub: "~250 words" },
    { value: "thread", label: "Thread", sub: "3 parts" },
];

// ─── Mock data ────────────────────────────────────────────────────────────────
const FREE_LIMIT = 10;
const USED = 3; // mock — will come from chrome.storage later

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
    const [mode, setMode] = useState<Mode>("ideas");
    const [topic, setTopic] = useState("");
    const [tone, setTone] = useState<Tone>("professional");
    const [length, setLength] = useState<Length>("medium");

    const remaining = FREE_LIMIT - USED;
    const isPro = false; // mock

    return (
        <div className="popup-root">
            {/* ── Header ─────────────────────────────── */}
            <header className="header">
                <div className="logo-icon pulse-glow">
                    <PenLine size={18} strokeWidth={2.5} />
                </div>
                <div className="header-text">
                    <h1>PulseWrite</h1>
                    <span>LinkedIn Ghostwriter</span>
                </div>
                <div className="badge-pro">
                    {isPro ? (
                        <><Crown size={10} /> Pro</>
                    ) : (
                        <><Zap size={10} /> Free</>
                    )}
                </div>
            </header>

            {/* ── Generation counter ─────────────────── */}
            {!isPro && (
                <div className="gen-bar">
                    <div className="gen-bar-track">
                        <div
                            className="gen-bar-fill"
                            style={{ width: `${(USED / FREE_LIMIT) * 100}%` }}
                        />
                    </div>
                    <span className="gen-bar-label">
                        {remaining} / {FREE_LIMIT} free generations left
                    </span>
                </div>
            )}

            {/* ── Mode tabs ──────────────────────────── */}
            <div className="mode-tabs">
                <button
                    className={`mode-tab ${mode === "ideas" ? "active" : ""}`}
                    onClick={() => setMode("ideas")}
                >
                    <Lightbulb size={14} />
                    Generate Ideas
                </button>
                <button
                    className={`mode-tab ${mode === "write" ? "active" : ""}`}
                    onClick={() => setMode("write")}
                >
                    <PenLine size={14} />
                    Write Post
                </button>
            </div>

            {/* ── Main card ──────────────────────────── */}
            <main className="main-card">

                {/* Topic input */}
                <div className="field">
                    <label className="field-label">
                        {mode === "ideas" ? "What's the theme?" : "Topic or rough draft"}
                    </label>
                    <textarea
                        className="field-input"
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        placeholder={
                            mode === "ideas"
                                ? "e.g. AI trends, startup lessons, leadership…"
                                : "e.g. Why I quit my corporate job to build in public…"
                        }
                        rows={3}
                    />
                </div>

                {/* Tone selector (Write mode only) */}
                {mode === "write" && (
                    <div className="field">
                        <label className="field-label">Tone</label>
                        <div className="tone-grid">
                            {TONES.map(t => (
                                <button
                                    key={t.value}
                                    className={`tone-btn ${tone === t.value ? "active" : ""}`}
                                    onClick={() => setTone(t.value)}
                                >
                                    <span className="tone-emoji">{t.emoji}</span>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Length selector (Write mode only) */}
                {mode === "write" && (
                    <div className="field">
                        <label className="field-label">Length</label>
                        <div className="length-grid">
                            {LENGTHS.map(l => (
                                <button
                                    key={l.value}
                                    className={`length-btn ${length === l.value ? "active" : ""}`}
                                    onClick={() => setLength(l.value)}
                                >
                                    <span className="length-label">{l.label}</span>
                                    <span className="length-sub">{l.sub}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Result placeholder area */}
                <div className="result-area">
                    <div className="result-empty">
                        <Sparkles size={24} className="result-icon" />
                        <p>
                            {mode === "ideas"
                                ? "5 ready-to-use post ideas will appear here"
                                : "Your AI-written post will appear here"}
                        </p>
                        <span>Powered by Llama 3.1 via Groq</span>
                    </div>
                </div>

                {/* CTA button */}
                <button
                    className="cta-btn"
                    disabled={remaining === 0}
                >
                    {mode === "ideas" ? (
                        <><Lightbulb size={16} /> Generate 5 Ideas <ChevronRight size={14} className="cta-arrow" /></>
                    ) : (
                        <><Sparkles size={16} /> Write My Post <ChevronRight size={14} className="cta-arrow" /></>
                    )}
                </button>

                {remaining === 0 && (
                    <p className="limit-msg">
                        You've used all free generations.{" "}
                        <a href="#" className="upgrade-link">Upgrade to Pro →</a>
                    </p>
                )}
            </main>

            {/* ── Footer ─────────────────────────────── */}
            <footer className="footer">
                <button className="footer-link">
                    <RotateCcw size={11} /> Reset
                </button>
                <a href="#" className="upgrade-link footer-upgrade">
                    <Crown size={11} /> Upgrade to Pro – $9.99/mo
                </a>
            </footer>
        </div>
    );
}
