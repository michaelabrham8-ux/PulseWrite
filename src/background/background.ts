/**
 * PulseWrite Background Service Worker
 * Handles extension lifecycle events and message routing.
 */

// Extension installed / updated
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
            free_generations_used: 0,
            free_generations_limit: 10,
        });
        console.log("[PulseWrite] Default settings saved.");
    }
});

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[PulseWrite] Message received:", message.type, "from:", sender.tab?.url);

    switch (message.type) {
        /**
         * OPEN_PULSEWRITE — sent by the content script when user clicks the ✨ button.
         * chrome.action.openPopup() only works when the extension has focus; we use it
         * as the primary approach and log a fallback hint for future side-panel support.
         */
        case "OPEN_PULSEWRITE": {
            console.log("[PulseWrite] ✨ Content script requested popup open");
            // openPopup() requires the extension action to be enabled (always true here)
            if (chrome.action?.openPopup) {
                chrome.action.openPopup().catch((err: unknown) => {
                    // This can fail if no window is focused — log only
                    console.warn("[PulseWrite] openPopup failed (expected in some contexts):", err);
                });
            }
            sendResponse({ status: "ok" });
            break;
        }

        case "GENERATE_IDEAS":
            console.log("[PulseWrite] Generate ideas request:", message.payload);
            sendResponse({ status: "pending", message: "Groq integration coming in Day 3" });
            break;

        case "GHOSTWRITE":
            console.log("[PulseWrite] Ghostwrite request:", message.payload);
            sendResponse({ status: "pending", message: "Groq integration coming in Day 3" });
            break;

        case "GET_SETTINGS":
            chrome.storage.sync.get("pulsewrite_settings", (result) => {
                sendResponse({ settings: result.pulsewrite_settings });
            });
            return true; // async

        case "GET_USAGE":
            chrome.storage.local.get(["free_generations_used", "free_generations_limit"], (result) => {
                sendResponse(result);
            });
            return true;

        default:
            console.warn("[PulseWrite] Unknown message type:", message.type);
            sendResponse({ status: "error", message: "Unknown message type" });
    }
});

console.log("[PulseWrite] 🔧 Background service worker started");
