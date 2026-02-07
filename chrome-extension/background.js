// Kelion AI Browser Control - Background Service Worker
// Handles communication between K AI and content scripts

console.log('🤖 Kelion Background Service Worker started');

// Listen for messages from K AI (kelionai.app)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    console.log('📨 External message from K:', request);

    if (sender.origin !== 'https://kelionai.app') {
        console.warn('❌ Unauthorized origin:', sender.origin);
        return;
    }

    handleKCommand(request)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));

    return true; // Keep channel open
});

// Listen for internal messages (from content script)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'screenshot') {
        takeScreenshot(sender.tab.id)
            .then(dataUrl => sendResponse({ success: true, dataUrl }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

async function handleKCommand(command) {
    console.log('🎯 Processing K command:', command);

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (command.action === 'navigate') {
        // Navigate to URL first
        await chrome.tabs.update(tab.id, { url: command.url });

        // Wait for page load
        await waitForPageLoad(tab.id);

        // If there's a follow-up action (like click), do it
        if (command.then) {
            await sendToContentScript(tab.id, command.then);
        }

        return { success: true, url: command.url };
    } else {
        // Send command to content script
        return await sendToContentScript(tab.id, command);
    }
}

async function sendToContentScript(tabId, command) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, command, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(response);
            }
        });
    });
}

async function waitForPageLoad(tabId) {
    return new Promise((resolve) => {
        const listener = (tabId_updated, changeInfo) => {
            if (tabId_updated === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                // Extra delay to ensure scripts are loaded
                setTimeout(resolve, 500);
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
    });
}

async function takeScreenshot(tabId) {
    return await chrome.tabs.captureVisibleTab(null, {
        format: 'png',
        quality: 80
    });
}

// Heartbeat to keep service worker alive
setInterval(() => {
    console.log('💓 Kelion Browser Control active');
}, 25000);
