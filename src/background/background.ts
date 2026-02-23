/**
 * PulseWrite Background Service Worker
 * Handles extension lifecycle events and message routing.
 */

// Extension installed / updated
chrome.runtime.onInstalled.addListener((details) => {
    console.log("[PulseWrite] 🎉 Extension installed!", details.reason);

    if (details.reason === "install") {
        // Set default settings
        chrome.storage.sync.set({
            pulsewrite_settings: {
                model: "llama-3.1-70b-versatile",
                tone: "professional",
                postLength: "medium",
                language: "en",
                onboardingComplete: false,
            },
        });
        console.log("[PulseWrite] Default settings saved to chrome.storage.sync");
    }
});

// Message listener for communication between content script, popup, and background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[PulseWrite] Message received:", message, "from:", sender.tab?.url);

    switch (message.type) {
        case "OPEN_PULSEWRITE":
            // Future: open side panel or trigger popup
            console.log("[PulseWrite] Open request from content script");
            sendResponse({ status: "ok" });
            break;

        case "GENERATE_IDEAS":
            // Future: call Groq API via background to avoid CORS
            console.log("[PulseWrite] Generate ideas request:", message.payload);
            sendResponse({ status: "pending", message: "Generation not yet implemented" });
            break;

        case "GET_SETTINGS":
            chrome.storage.sync.get("pulsewrite_settings", (result) => {
                sendResponse({ settings: result.pulsewrite_settings });
            });
            return true; // Keep message channel open for async response

        default:
            console.log("[PulseWrite] Unknown message type:", message.type);
            sendResponse({ status: "error", message: "Unknown message type" });
    }
});

console.log("[PulseWrite] 🔧 Background service worker started");
