/**
 * PulseWrite Content Script
 * Detects LinkedIn compose box via MutationObserver (debounced),
 * injects a floating ✨ button on focus, removes it when compose closes.
 */

const PULSEWRITE_BTN_ID = "pulsewrite-floating-btn";
const PULSEWRITE_WRAPPER_ID = "pulsewrite-wrapper";

const COMPOSE_SELECTORS = [
    'div[role="textbox"][contenteditable="true"]',
    'div[aria-label*="What do you want to talk about"][contenteditable="true"]',
    'div[aria-label*="Start a post"][contenteditable="true"]',
    ".ql-editor[contenteditable='true']",
    ".share-creation-state__text-editor .ql-editor",
    ".editor-content .ql-editor",
    ".ql-editor[data-placeholder]",
];

let currentComposeBox: Element | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Extension context guard ──────────────────────────────────────────────────
// "Extension context invalidated" happens after the extension is reloaded while
// the content script is still running. Check before every chrome.* call.
function isExtensionAlive(): boolean {
    try { return !!chrome.runtime?.id; }
    catch { return false; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function debounce(fn: () => void, ms: number) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, ms);
}

function findComposeBox(): Element | null {
    for (const sel of COMPOSE_SELECTORS) {
        try {
            const el = document.querySelector(sel);
            if (el) return el;
        } catch { /* ignore invalid selectors */ }
    }
    return null;
}

function getPositioningParent(editor: Element): HTMLElement {
    let el: HTMLElement | null = editor.parentElement;
    for (let i = 0; i < 8 && el; i++) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 100) return el;
        el = el.parentElement;
    }
    return (editor.parentElement ?? document.body) as HTMLElement;
}

// ─── Floating button ──────────────────────────────────────────────────────────

function createFloatingButton(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.id = PULSEWRITE_WRAPPER_ID;
    Object.assign(wrapper.style, {
        position: "absolute", bottom: "8px", right: "8px",
        zIndex: "2147483647", display: "flex",
        alignItems: "center", pointerEvents: "none",
    });

    const btn = document.createElement("button");
    btn.id = PULSEWRITE_BTN_ID;
    btn.title = "PulseWrite – Write with AI ✨";
    btn.setAttribute("aria-label", "Open PulseWrite");
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962
               L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0
               L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964
               L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
      <path d="M20 3v4"/><path d="M22 5h-4"/>
      <path d="M4 17v2"/><path d="M5 18H3"/>
    </svg>`;

    Object.assign(btn.style, {
        pointerEvents: "auto", display: "flex",
        alignItems: "center", justifyContent: "center",
        width: "34px", height: "34px", borderRadius: "50%",
        border: "1.5px solid rgba(99,102,241,0.5)",
        background: "linear-gradient(135deg,#6366f1 0%,#818cf8 100%)",
        color: "#fff", cursor: "pointer",
        boxShadow: "0 2px 12px rgba(99,102,241,0.5)",
        transition: "transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s",
        opacity: "0.93", padding: "0", outline: "none",
    });

    btn.addEventListener("mouseenter", () => {
        btn.style.transform = "scale(1.12)";
        btn.style.boxShadow = "0 4px 20px rgba(99,102,241,0.7)";
        btn.style.opacity = "1";
    });
    btn.addEventListener("mouseleave", () => {
        btn.style.transform = "scale(1)";
        btn.style.boxShadow = "0 2px 12px rgba(99,102,241,0.5)";
        btn.style.opacity = "0.93";
    });
    btn.addEventListener("mousedown", (e) => e.preventDefault());

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (!isExtensionAlive()) {
            console.warn("[PulseWrite] Extension was reloaded — please refresh the LinkedIn page.");
            return;
        }

        try {
            chrome.storage.local.set({
                pw_compose_text: (currentComposeBox as HTMLElement | null)?.innerText ?? "",
            });
        } catch { /* ignore */ }

        try {
            chrome.runtime.sendMessage({ type: "OPEN_PULSEWRITE" }, () => {
                void chrome.runtime.lastError;
            });
        } catch { /* ignore */ }
    });

    wrapper.appendChild(btn);
    return wrapper;
}

function removeButton(): void {
    document.getElementById(PULSEWRITE_WRAPPER_ID)?.remove();
}

function injectButton(composeBox: Element): void {
    if (document.getElementById(PULSEWRITE_WRAPPER_ID)) return;
    const container = getPositioningParent(composeBox);
    if (getComputedStyle(container).position === "static") {
        container.style.position = "relative";
    }
    container.appendChild(createFloatingButton());
    console.log("[PulseWrite] ✅ Floating button injected");
}

// ─── Focus / blur listeners ───────────────────────────────────────────────────

function attachListeners(box: Element): void {
    box.addEventListener("focus", () => {
        if (isExtensionAlive()) injectButton(box);
    }, true);
    box.addEventListener("blur", (e) => {
        const related = (e as FocusEvent).relatedTarget as Node | null;
        const btn = document.getElementById(PULSEWRITE_BTN_ID);
        if (btn && related && (btn === related || btn.contains(related))) return;
        setTimeout(removeButton, 200);
    }, true);
}

// ─── MutationObserver ─────────────────────────────────────────────────────────

let observer: MutationObserver | null = null;

function checkDOM(): void {
    if (!isExtensionAlive()) { observer?.disconnect(); return; }

    const box = findComposeBox();

    if (box && box !== currentComposeBox) {
        currentComposeBox = box;
        console.log("[PulseWrite] 🎯 Compose box detected");
        attachListeners(box);
        if (document.activeElement === box || box.contains(document.activeElement)) {
            injectButton(box);
        }
    }

    if (!box && currentComposeBox) {
        currentComposeBox = null;
        removeButton();
    }
}

function startObserver(): void {
    if (observer) return;
    observer = new MutationObserver(() => debounce(checkDOM, 200));
    observer.observe(document.body, { childList: true, subtree: true });
    console.log("[PulseWrite] 👀 MutationObserver started");
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
    if (!isExtensionAlive()) return;
    console.log("[PulseWrite] 🚀 Content script loaded on LinkedIn");
    checkDOM();
    startObserver();
}

window.addEventListener("beforeunload", () => {
    observer?.disconnect();
    removeButton();
});

try {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
} catch (err) {
    console.warn("[PulseWrite] Init error:", err);
}
