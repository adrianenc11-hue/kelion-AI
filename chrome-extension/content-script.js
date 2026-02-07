// Kelion AI Browser Control - Content Script
// Runs in every webpage, enables DOM manipulation

class KelionBrowserControl {
    constructor() {
        this.commandQueue = [];
        this.isProcessing = false;
        console.log('🤖 Kelion Browser Control active');
        this.setupMessageListener();
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleCommand(request)
                .then(result => sendResponse({ success: true, data: result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Keep message channel open for async
        });
    }

    async handleCommand(command) {
        console.log('📥 Command received:', command);

        switch (command.action) {
            case 'navigate':
                return await this.navigate(command.url);
            case 'click':
                return await this.clickElement(command.selector, command.text);
            case 'fill':
                return await this.fillInput(command.selector, command.value);
            case 'waitFor':
                return await this.waitForElement(command.selector, command.timeout);
            case 'getText':
                return await this.getText(command.selector);
            case 'screenshot':
                return await this.takeScreenshot();
            default:
                throw new Error(`Unknown action: ${command.action}`);
        }
    }

    async navigate(url) {
        window.location.href = url;
        return { url, message: `Navigating to ${url}` };
    }

    async clickElement(selector, text) {
        let element;

        if (text) {
            // Smart find by text content
            element = this.findElementByText(text);
        } else if (selector) {
            element = document.querySelector(selector);
        }

        if (!element) {
            throw new Error(`Element not found: ${selector || text}`);
        }

        // Scroll into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Wait a bit for scroll
        await this.delay(300);

        // Click
        element.click();

        console.log('✅ Clicked:', element);
        return {
            success: true,
            element: this.getElementInfo(element),
            message: `Clicked ${text || selector}`
        };
    }

    findElementByText(text) {
        // Try multiple strategies
        const selectors = [
            'button', 'a', '[role="button"]', 'input[type="submit"]',
            '[onclick]', '.btn', '.button'
        ];

        for (const selector of selectors) {
            const elements = Array.from(document.querySelectorAll(selector));
            const match = elements.find(el =>
                el.textContent.toLowerCase().includes(text.toLowerCase()) ||
                el.getAttribute('aria-label')?.toLowerCase().includes(text.toLowerCase()) ||
                el.getAttribute('title')?.toLowerCase().includes(text.toLowerCase())
            );
            if (match) return match;
        }

        // Fallback: any element with matching text
        const allElements = Array.from(document.querySelectorAll('*'));
        return allElements.find(el =>
            el.textContent.trim().toLowerCase() === text.toLowerCase()
        );
    }

    async fillInput(selector, value) {
        const input = document.querySelector(selector);
        if (!input) throw new Error(`Input not found: ${selector}`);

        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        return { success: true, selector, value };
    }

    async waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            // Check if already exists
            const existing = document.querySelector(selector);
            if (existing) {
                resolve(this.getElementInfo(existing));
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(this.getElementInfo(element));
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element not found after ${timeout}ms: ${selector}`));
            }, timeout);
        });
    }

    async getText(selector) {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Element not found: ${selector}`);
        return { text: element.textContent.trim() };
    }

    async takeScreenshot() {
        // Request screenshot from background script
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'screenshot' }, resolve);
        });
    }

    getElementInfo(element) {
        return {
            tag: element.tagName,
            text: element.textContent.slice(0, 100),
            id: element.id,
            class: element.className
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize
const kelionControl = new KelionBrowserControl();
