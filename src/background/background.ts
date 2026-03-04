/**
 * PulseWrite Background Service Worker – Day 3
 * Handles: Groq API calls, usage tracking, tab tracking, and message routing.
 */

import { generateIdeas, ghostwrite } from "../utils/groq";
import type { Tone, PostLength } from "../utils/groq";

// ─── Usage helpers ────────────────────────────────────────────────────────────

const FREE_LIMIT = 10;

interface UsageRecord {
    count: number;
    monthKey: string; // "YYYY-MM"
}

function currentMonthKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function getUsage(): Promise<UsageRecord> {
    return new Promise((resolve) => {
        chrome.storage.local.get(["pw_usage_count", "pw_usage_month"], (r) => {
            const storedMonth = (r.pw_usage_month as string | undefined) ?? "";
            const monthKey = currentMonthKey();
            if (storedMonth !== monthKey) {
                // Month rolled over — reset
                resolve({ count: 0, monthKey });
            } else {
                resolve({ count: (r.pw_usage_count as number | undefined) ?? 0, monthKey });
            }
        });
    });
}

async function incrementUsage(): Promise<UsageRecord> {
    const usage = await getUsage();
    const updated = { count: usage.count + 1, monthKey: usage.monthKey };
    await new Promise<void>((resolve) =>
        chrome.storage.local.set(
            { pw_usage_count: updated.count, pw_usage_month: updated.monthKey },
            resolve
        )
    );
    return updated;
}

// ─── API key helper ───────────────────────────────────────────────────────────

async function getApiKey(): Promise<string> {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get("pw_groq_api_key", (r) => {
            // 1. User saved a key via Settings UI → use that
            const storedKey = (r.pw_groq_api_key as string | undefined) ?? "";
            if (storedKey) { resolve(storedKey); return; }

            // 2. Fallback: key baked in at build time from .env (VITE_GROQ_API_KEY)
            const envKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
            if (envKey) { resolve(envKey); return; }

            reject(new Error("NO_API_KEY"));
        });
    });
}


// ─── Active compose tab tracking ─────────────────────────────────────────────

let activeComposeTabId: number | null = null;

// ─── Install ──────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
    console.log("[PulseWrite] 🎉 Extension installed!", details.reason);
    if (details.reason === "install") {
        chrome.storage.sync.set({
            pulsewrite_settings: {
                model: "llama-3.1-70b-versatile",
                tone: "professional",
                postLength: "medium",
                language: "en",
                onboardingComplete: false,
            },
        });
        chrome.storage.local.set({
            pw_usage_count: 0,
            pw_usage_month: currentMonthKey(),
        });
        console.log("[PulseWrite] Default settings saved.");
    }
});

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const type: string = message.type;
    console.log("[PulseWrite]", type, "from", sender.tab?.url ?? "popup");

    switch (type) {
        // ── Content script announces which tab has an open compose box ──────
        case "COMPOSE_OPENED": {
            if (sender.tab?.id) {
                activeComposeTabId = sender.tab.id;
                console.log("[PulseWrite] Compose tab registered:", activeComposeTabId);
            }
            sendResponse({ status: "ok" });
            break;
        }

        // ── Content script requests popup to open ────────────────────────────
        case "OPEN_PULSEWRITE": {
            if (sender.tab?.id) activeComposeTabId = sender.tab.id;
            if (chrome.action?.openPopup) {
                chrome.action.openPopup().catch((err: unknown) =>
                    console.warn("[PulseWrite] openPopup failed:", err)
                );
            }
            sendResponse({ status: "ok" });
            break;
        }

        // ── Popup asks for current usage ──────────────────────────────────────
        case "GET_USAGE": {
            getUsage().then((usage) => {
                sendResponse({ used: usage.count, limit: FREE_LIMIT, remaining: FREE_LIMIT - usage.count });
            });
            return true;
        }

        // ── Popup asks for the active tab ID (for insert) ─────────────────────
        case "GET_ACTIVE_TAB": {
            sendResponse({ tabId: activeComposeTabId });
            break;
        }

        // ── Popup: generate 5 ideas ────────────────────────────────────────────
        case "GENERATE_IDEAS": {
            const handleGenerateIdeas = async () => {
                try {
                    const usage = await getUsage();
                    if (usage.count >= FREE_LIMIT) {
                        sendResponse({ error: "LIMIT_REACHED" });
                        return;
                    }
                    const apiKey = await getApiKey();
                    const ideas = await generateIdeas(apiKey, {
                        tone: message.tone as Tone,
                        niche: message.niche,
                        samplePosts: message.samplePosts,
                    });
                    const updated = await incrementUsage();
                    sendResponse({ ideas, used: updated.count, remaining: FREE_LIMIT - updated.count });
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    console.error("[PulseWrite] generateIdeas error:", msg);
                    sendResponse({ error: msg === "NO_API_KEY" ? "NO_API_KEY" : "API_ERROR", details: msg });
                }
            };
            handleGenerateIdeas();
            return true; // async
        }

        // ── Popup: ghostwrite a post ───────────────────────────────────────────
        case "GHOSTWRITE": {
            const handleGhostwrite = async () => {
                try {
                    const usage = await getUsage();
                    if (usage.count >= FREE_LIMIT) {
                        sendResponse({ error: "LIMIT_REACHED" });
                        return;
                    }
                    const apiKey = await getApiKey();
                    const post = await ghostwrite(apiKey, {
                        topic: message.topic as string,
                        tone: message.tone as Tone,
                        length: message.length as PostLength,
                        samplePosts: message.samplePosts,
                    });
                    const updated = await incrementUsage();
                    sendResponse({ post, used: updated.count, remaining: FREE_LIMIT - updated.count });
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    console.error("[PulseWrite] ghostwrite error:", msg);
                    sendResponse({ error: msg === "NO_API_KEY" ? "NO_API_KEY" : "API_ERROR", details: msg });
                }
            };
            handleGhostwrite();
            return true;
        }

        // ── Popup: insert text into LinkedIn compose box ───────────────────────
        case "INSERT_TEXT": {
            const tabId = (message.tabId as number | undefined) ?? activeComposeTabId;
            if (!tabId) {
                sendResponse({ error: "NO_TAB" });
                break;
            }
            chrome.scripting.executeScript({
                target: { tabId },
                args: [message.text as string],
                func: (textToInsert: string) => {
                    // Try multiple strategies to insert text into LinkedIn's editor
                    const SELECTORS = [
                        'div[role="textbox"][contenteditable="true"]',
                        'div[aria-label*="What do you want to talk about"][contenteditable="true"]',
                        'div[aria-label*="Start a post"][contenteditable="true"]',
                        ".ql-editor[contenteditable]",
                    ];
                    let editor: HTMLElement | null = null;
                    for (const sel of SELECTORS) {
                        const el = document.querySelector<HTMLElement>(sel);
                        if (el) { editor = el; break; }
                    }
                    if (!editor) return false;

                    editor.focus();

                    // Strategy 1: execCommand (works in most contenteditable divs)
                    const sel = window.getSelection();
                    if (sel) {
                        const range = document.createRange();
                        range.selectNodeContents(editor);
                        range.collapse(false);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                    const inserted = document.execCommand("insertText", false, textToInsert);

                    // Strategy 2: native input event (React-friendly)
                    if (!inserted) {
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                            HTMLElement.prototype,
                            "innerText"
                        )?.set;
                        if (nativeInputValueSetter) {
                            nativeInputValueSetter.call(editor, textToInsert);
                        } else {
                            editor.innerText = textToInsert;
                        }
                        editor.dispatchEvent(new Event("input", { bubbles: true }));
                        editor.dispatchEvent(new Event("change", { bubbles: true }));
                    }

                    editor.focus();
                    return true;
                },
            })
                .then(([result]) => {
                    sendResponse({ ok: result?.result ?? false });
                })
                .catch((err: unknown) => {
                    const msg = err instanceof Error ? err.message : String(err);
                    console.error("[PulseWrite] scripting.executeScript failed:", msg);
                    sendResponse({ error: msg });
                });
            return true;
        }

        // ── Save API key from settings ─────────────────────────────────────────
        case "SAVE_API_KEY": {
            chrome.storage.local.set({ pw_groq_api_key: message.key }, () => {
                sendResponse({ status: "ok" });
            });
            return true;
        }

        // ── Get settings ───────────────────────────────────────────────────────
        case "GET_SETTINGS": {
            chrome.storage.sync.get("pulsewrite_settings", (r) =>
                sendResponse({ settings: r.pulsewrite_settings })
            );
            return true;
        }

        default:
            console.warn("[PulseWrite] Unknown message type:", type);
            sendResponse({ error: "Unknown message type" });
    }
});

console.log("[PulseWrite] 🔧 Background service worker started");
