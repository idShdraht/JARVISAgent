import axios from 'axios';
import { exec } from 'child_process';
import { DatabaseBuffer } from './DatabaseBuffer.js';

/**
 * JARVIS Universal Relay Layer
 * Normalizes messages from social platforms and routes them through the AI core.
 */
export class JarvisRelay {
    constructor(config) {
        this.config = config;
        this.db = new DatabaseBuffer();
        this.enginePath = './jarvis'; // Path to the underlying engine
    }

    /**
     * Entry point for messages from any source (IG, WhatsApp, etc.)
     */
    async onMessageReceived(platform, senderId, text, rawData = {}) {
        const normalized = {
            platform,
            senderId,
            message: text,
            timestamp: Date.now(),
            metadata: rawData
        };

        console.log(`[JARVIS RELAY] Ingested message from ${platform}: ${text}`);

        try {
            // 1. Log locally first for resilience
            await this.db.queueLocally(normalized);

            // 2. Get AI Response from JARVIS Core
            const responseText = await this.getEngineResponse(text);

            // 3. Route response back
            await this.sendReply(platform, senderId, responseText);

            // 4. Try to sync if online
            this.db.syncToCloud().catch(err => console.error('[JARVIS SYNC] Offline or Sync failed:', err.message));
        } catch (error) {
            console.error('[JARVIS RELAY ERROR]', error.message);
        }
    }

    /**
     * Interfaces with the underlying JARVIS engine
     */
    async getEngineResponse(input) {
        return new Promise((resolve, reject) => {
            // white-label it as JARVIS
            const cmd = `echo "${input}" | ${this.enginePath} --agent=jarvis`;

            // For now, we simulate a response
            setTimeout(() => {
                resolve(`[JARVIS] Processing your request: "${input}". Logic verified.`);
            }, 500);
        });
    }

    /**
     * Routes the AI response back to the original platform
     */
    async sendReply(platform, senderId, text) {
        console.log(`[JARVIS REPLY] Sending to ${platform} (${senderId}): ${text}`);

        // Example: If platform is Instagram, call IG API
        // This would be replaced by actual driver calls
        switch (platform.toLowerCase()) {
            case 'instagram':
                // await igClient.entity.directThreadById(senderId).broadcastText(text);
                break;
            case 'whatsapp':
                // await waClient.sendMessage(senderId, text);
                break;
            default:
                console.warn(`[JARVIS] No outbound driver for ${platform}`);
        }
    }
}
