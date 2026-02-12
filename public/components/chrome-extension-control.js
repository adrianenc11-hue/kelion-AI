// Kelion AI - Chrome Extension Integration
// Add this to smart-functions.js or create as separate module

class ChromeExtensionControl {
    constructor() {
        this.extensionId = null; // Will be set after extension is published
        this.isAvailable = false;
        this.checkExtension();
    }

    async checkExtension() {
        // Check if extension is installed
        try {
            // Try to send a test message
            const response = await this.sendCommand({ action: 'ping' });
            this.isAvailable = response.success;
            console.log('✅ Chrome Extension detected');
        } catch (error) {
            this.isAvailable = false;
            console.log('❌ Chrome Extension not installed');
        }
    }

    async sendCommand(command) {
        return new Promise((resolve, reject) => {
            if (!chrome?.runtime?.sendMessage) {
                reject(new Error('Chrome API not available'));
                return;
            }

            chrome.runtime.sendMessage(this.extensionId, command, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    // Main browser control functions
    async navigateAndClick(url, buttonText) {
        return await this.sendCommand({
            action: 'navigate',
            url: url,
            then: {
                action: 'click',
                text: buttonText
            }
        });
    }

    async clickElement(selector, text) {
        return await this.sendCommand({
            action: 'click',
            selector,
            text
        });
    }

    async fillForm(fields) {
        const results = [];
        for (const field of fields) {
            const result = await this.sendCommand({
                action: 'fill',
                selector: field.selector,
                value: field.value
            });
            results.push(result);
        }
        return results;
    }

    async navigateTo(url) {
        return await this.sendCommand({
            action: 'navigate',
            url
        });
    }

    async waitForElement(selector, timeout = 5000) {
        return await this.sendCommand({
            action: 'waitFor',
            selector,
            timeout
        });
    }

    async getText(selector) {
        return await this.sendCommand({
            action: 'getText',
            selector
        });
    }

    async takeScreenshot() {
        return await this.sendCommand({
            action: 'screenshot'
        });
    }
}

// Initialize and expose globally
window.chromeExtensionControl = new ChromeExtensionControl();

// Example usage:
// await chromeExtensionControl.navigateAndClick('https://radiozu.ro', 'Live');
