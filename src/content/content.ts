/**
 * PulseWrite Content Script
 * Detects LinkedIn compose box and injects a floating PulseWrite button.
 */

const PULSEWRITE_BUTTON_ID = "pulsewrite-floating-btn";

/** LinkedIn compose box selectors (multiple fallbacks) */
const COMPOSE_SELECTORS = [
    ".ql-editor[data-placeholder]",
    '[role="textbox"][contenteditable="true"]',
    ".share-creation-state__text-editor .ql-editor",
    ".editor-content .ql-editor",
];

function createFloatingButton(): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.id = PULSEWRITE_BUTTON_ID;
    btn.title = "PulseWrite – Generate post ideas";
    btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 20h9"/>
      <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>
    </svg>
  `;

    // Inline styles to avoid conflict with LinkedIn's CSS
    Object.assign(btn.style, {
        position: "absolute",
        top: "-12px",
        right: "8px",
        width: "32px",
        height: "32px",
        borderRadius: "8px",
        border: "1px solid rgba(99, 102, 241, 0.3)",
        background: "linear-gradient(135deg, #6366f1, #818cf8)",
        color: "#fff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "9999",
        boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
        transition: "all 0.2s ease",
        opacity: "0.9",
    });

    btn.addEventListener("mouseenter", () => {
        btn.style.opacity = "1";
        btn.style.transform = "scale(1.1)";
        btn.style.boxShadow = "0 4px 16px rgba(99, 102, 241, 0.5)";
    });

    btn.addEventListener("mouseleave", () => {
        btn.style.opacity = "0.9";
        btn.style.transform = "scale(1)";
        btn.style.boxShadow = "0 2px 8px rgba(99, 102, 241, 0.3)";
    });

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log("[PulseWrite] Floating button clicked — opening popup...");
        // Future: send message to background to open side panel or trigger generation
        chrome.runtime.sendMessage({ type: "OPEN_PULSEWRITE" });
    });

    return btn;
}

function injectButton(): void {
    // Don't inject if already present
    if (document.getElementById(PULSEWRITE_BUTTON_ID)) return;

    for (const selector of COMPOSE_SELECTORS) {
        const editor = document.querySelector(selector);
        if (editor) {
            const parent = editor.closest(".ql-editor")?.parentElement ?? editor.parentElement;
            if (parent) {
                parent.style.position = "relative";
                parent.appendChild(createFloatingButton());
                console.log("[PulseWrite] ✅ Floating button injected near LinkedIn compose box");
                return;
            }
        }
    }
}

/** Observe DOM changes to catch dynamically loaded compose boxes */
function observeDOM(): void {
    const observer = new MutationObserver(() => {
        injectButton();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    console.log("[PulseWrite] 👀 DOM observer started — watching for compose box");
}

// Initialize
function init(): void {
    console.log("[PulseWrite] 🚀 Content script loaded on LinkedIn");
    injectButton();
    observeDOM();
}

// Wait for DOM ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
