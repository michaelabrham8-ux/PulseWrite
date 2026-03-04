/**
 * PulseWrite Content Script – Day 2
 * Detects LinkedIn compose box via MutationObserver (debounced),
 * injects a floating ✨ button on focus, removes it when compose closes.
 */

const PULSEWRITE_BTN_ID = "pulsewrite-floating-btn";
const PULSEWRITE_WRAPPER_ID = "pulsewrite-wrapper";

/** All known LinkedIn compose-box selectors (2026 DOM, multiple fallbacks) */
const COMPOSE_SELECTORS = [
    'div[role="textbox"][contenteditable="true"]',
    'div[aria-label*="What do you want to talk about"][contenteditable="true"]',
    'div[aria-label*="Start a post"][contenteditable="true"]',
    'div[data-placeholder][contenteditable="true"].ql-editor',
    ".share-creation-state__text-editor .ql-editor",
    ".editor-content .ql-editor",
    ".ql-editor[data-placeholder]",
];

// ─── State ────────────────────────────────────────────────────────────────────

let currentComposeBox: Element | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function debounce(fn: () => void, ms: number) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, ms);
}

function findComposeBox(): Element | null {
    for (const selector of COMPOSE_SELECTORS) {
        const el = document.querySelector(selector);
        if (el) return el;
    }
    return null;
}

/** Returns the best ancestor to use as a positioning container */
function getPositioningParent(editor: Element): HTMLElement | null {
    // Walk up until we find a reasonably-sized container (not the whole page)
    let el = editor.parentElement;
    for (let i = 0; i < 6 && el; i++) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 200 && rect.height > 60) return el as HTMLElement;
        el = el.parentElement;
    }
    return (editor.parentElement as HTMLElement) ?? null;
}

// ─── Button creation ──────────────────────────────────────────────────────────

function createFloatingButton(): HTMLElement {
    // Wrapper keeps the button positioned relative to compose area
    const wrapper = document.createElement("div");
    wrapper.id = PULSEWRITE_WRAPPER_ID;
    Object.assign(wrapper.style, {
        position: "absolute",
        bottom: "8px",
        right: "8px",
        zIndex: "99999",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        pointerEvents: "none", // wrapper is invisible; only button catches events
    });

    const btn = document.createElement("button");
    btn.id = PULSEWRITE_BTN_ID;
    btn.title = "PulseWrite – Write with AI ✨";
    btn.setAttribute("aria-label", "Open PulseWrite");

    // Sparkles SVG (lucide-style)
    btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
      <path d="M20 3v4"/>
      <path d="M22 5h-4"/>
      <path d="M4 17v2"/>
      <path d="M5 18H3"/>
    </svg>`;

    Object.assign(btn.style, {
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "34px",
        height: "34px",
        borderRadius: "50%",
        border: "1.5px solid rgba(99,102,241,0.45)",
        background: "linear-gradient(135deg,#6366f1 0%,#818cf8 100%)",
        color: "#fff",
        cursor: "pointer",
        boxShadow: "0 2px 12px rgba(99,102,241,0.45)",
        transition: "transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease",
        opacity: "0.92",
        padding: "0",
        outline: "none",
    });

    btn.addEventListener("mouseenter", () => {
        btn.style.transform = "scale(1.12)";
        btn.style.boxShadow = "0 4px 20px rgba(99,102,241,0.65)";
        btn.style.opacity = "1";
    });
    btn.addEventListener("mouseleave", () => {
        btn.style.transform = "scale(1)";
        btn.style.boxShadow = "0 2px 12px rgba(99,102,241,0.45)";
        btn.style.opacity = "0.92";
    });
    btn.addEventListener("mousedown", (e) => {
        e.preventDefault(); // prevent blurring the compose box
    });

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log("[PulseWrite] ✨ Button clicked – sending OPEN_PULSEWRITE message");

        // Store a reference so the popup can inject text back
        if (currentComposeBox) {
            chrome.storage.local.set({
                pulsewrite_compose_active: true,
                pulsewrite_compose_text: (currentComposeBox as HTMLElement).innerText ?? "",
            });
        }

        chrome.runtime.sendMessage({ type: "OPEN_PULSEWRITE" }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn("[PulseWrite] runtime error:", chrome.runtime.lastError.message);
            } else {
                console.log("[PulseWrite] Response:", response);
            }
        });
    });

    wrapper.appendChild(btn);
    return wrapper;
}

// ─── Injection / removal ──────────────────────────────────────────────────────

function removeButton(): void {
    document.getElementById(PULSEWRITE_WRAPPER_ID)?.remove();
}

function injectButton(composeBox: Element): void {
    // Already injected?
    if (document.getElementById(PULSEWRITE_WRAPPER_ID)) return;

    const container = getPositioningParent(composeBox);
    if (!container) return;

    // Make sure the parent is positioned so `absolute` works
    const computedPos = getComputedStyle(container).position;
    if (computedPos === "static") container.style.position = "relative";

    container.appendChild(createFloatingButton());
    console.log("[PulseWrite] ✅ Floating button injected");
}

// ─── Focus / blur listeners ───────────────────────────────────────────────────

function attachFocusListeners(box: Element): void {
    box.addEventListener("focus", () => {
        console.log("[PulseWrite] Compose box focused – injecting button");
        injectButton(box);
    }, true);

    box.addEventListener("blur", (e) => {
        const related = (e as FocusEvent).relatedTarget as Node | null;
        // Don't remove if focus moved to the PulseWrite button itself
        const btn = document.getElementById(PULSEWRITE_BTN_ID);
        if (btn && related && btn.contains(related)) return;
        setTimeout(removeButton, 150); // small delay avoids race on click
    }, true);
}

// ─── MutationObserver ─────────────────────────────────────────────────────────

let domObserver: MutationObserver | null = null;

function checkForComposeBox(): void {
    const box = findComposeBox();

    if (box && box !== currentComposeBox) {
        currentComposeBox = box;
        console.log("[PulseWrite] 🎯 Compose box detected:", box.tagName, box.className.slice(0, 60));
        attachFocusListeners(box);

        // If box is already focused (e.g. opened programmatically), inject immediately
        if (document.activeElement === box || box.contains(document.activeElement)) {
            injectButton(box);
        }
    }

    if (!box && currentComposeBox) {
        console.log("[PulseWrite] Compose box gone – removing button");
        currentComposeBox = null;
        removeButton();
    }
}

function startObserver(): void {
    if (domObserver) return;

    domObserver = new MutationObserver(() => debounce(checkForComposeBox, 200));
    domObserver.observe(document.body, { childList: true, subtree: true, attributes: false });
    console.log("[PulseWrite] 👀 MutationObserver started");
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init(): void {
    console.log("[PulseWrite] 🚀 Content script loaded on LinkedIn");
    checkForComposeBox();
    startObserver();
}

// Cleanup
window.addEventListener("beforeunload", () => {
    domObserver?.disconnect();
    removeButton();
});

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
