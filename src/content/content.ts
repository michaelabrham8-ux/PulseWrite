/**
 * PulseWrite Content Script – Day 3
 * Detects LinkedIn compose box, injects ✨ floating button,
 * announces compose tab to background, and handles INSERT_TEXT from background.
 */

const PULSEWRITE_BTN_ID = "pulsewrite-floating-btn";
const PULSEWRITE_WRAPPER_ID = "pulsewrite-wrapper";

const COMPOSE_SELECTORS = [
    'div[role="textbox"][contenteditable="true"]',
    'div[aria-label*="What do you want to talk about"][contenteditable="true"]',
    'div[aria-label*="Start a post"][contenteditable="true"]',
    'div[data-placeholder][contenteditable="true"].ql-editor',
    ".share-creation-state__text-editor .ql-editor",
    ".editor-content .ql-editor",
    ".ql-editor[data-placeholder]",
];

let currentComposeBox: Element | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let composeAnnounced = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function getPositioningParent(editor: Element): HTMLElement | null {
    let el = editor.parentElement;
    for (let i = 0; i < 6 && el; i++) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 200 && rect.height > 60) return el as HTMLElement;
        el = el.parentElement;
    }
    return (editor.parentElement as HTMLElement) ?? null;
}

// ─── Button ───────────────────────────────────────────────────────────────────

function createFloatingButton(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.id = PULSEWRITE_WRAPPER_ID;
    Object.assign(wrapper.style, {
        position: "absolute",
        bottom: "8px",
        right: "8px",
        zIndex: "99999",
        display: "flex",
        alignItems: "center",
        pointerEvents: "none",
    });

    const btn = document.createElement("button");
    btn.id = PULSEWRITE_BTN_ID;
    btn.title = "PulseWrite – Write with AI ✨";
    btn.setAttribute("aria-label", "Open PulseWrite");
    btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
      <path d="M20 3v4"/><path d="M22 5h-4"/>
      <path d="M4 17v2"/><path d="M5 18H3"/>
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
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
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
    btn.addEventListener("mousedown", (e) => e.preventDefault());

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log("[PulseWrite] ✨ Button clicked");

        // Store compose text snapshot so popup can read it
        if (currentComposeBox) {
            chrome.storage.local.set({
                pw_compose_text: (currentComposeBox as HTMLElement).innerText ?? "",
            });
        }

        chrome.runtime.sendMessage({ type: "OPEN_PULSEWRITE" }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn("[PulseWrite]", chrome.runtime.lastError.message);
            } else {
                console.log("[PulseWrite] Response:", response);
            }
        });
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
    if (!container) return;
    if (getComputedStyle(container).position === "static") container.style.position = "relative";
    container.appendChild(createFloatingButton());
    console.log("[PulseWrite] ✅ Button injected");

    // Announce compose tab to background (once per session)
    if (!composeAnnounced) {
        chrome.runtime.sendMessage({ type: "COMPOSE_OPENED" }, () => {
            if (!chrome.runtime.lastError) composeAnnounced = true;
        });
    }
}

function attachFocusListeners(box: Element): void {
    box.addEventListener("focus", () => injectButton(box), true);
    box.addEventListener("blur", (e) => {
        const related = (e as FocusEvent).relatedTarget as Node | null;
        const btn = document.getElementById(PULSEWRITE_BTN_ID);
        if (btn && related && btn.contains(related)) return;
        setTimeout(removeButton, 150);
    }, true);
}

// ─── MutationObserver ─────────────────────────────────────────────────────────

let domObserver: MutationObserver | null = null;

function checkForComposeBox(): void {
    const box = findComposeBox();

    if (box && box !== currentComposeBox) {
        currentComposeBox = box;
        composeAnnounced = false; // re-announce for new compose session
        console.log("[PulseWrite] 🎯 Compose box detected");
        attachFocusListeners(box);
        if (document.activeElement === box || box.contains(document.activeElement)) {
            injectButton(box);
        }
    }
    if (!box && currentComposeBox) {
        currentComposeBox = null;
        composeAnnounced = false;
        removeButton();
    }
}

function startObserver(): void {
    if (domObserver) return;
    domObserver = new MutationObserver(() => debounce(checkForComposeBox, 200));
    domObserver.observe(document.body, { childList: true, subtree: true });
    console.log("[PulseWrite] 👀 Observer started");
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init(): void {
    console.log("[PulseWrite] 🚀 Content script loaded");
    checkForComposeBox();
    startObserver();
}

window.addEventListener("beforeunload", () => {
    domObserver?.disconnect();
    removeButton();
});

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
