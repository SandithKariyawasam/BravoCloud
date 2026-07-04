"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fireProjectWebhooks = fireProjectWebhooks;
const admin = __importStar(require("firebase-admin"));
const crypto_1 = __importDefault(require("crypto"));
/**
 * Fires configured webhooks for a project based on the event type.
 * @param projectId The ID of the project
 * @param event The event name (e.g., 'deployment.started', 'deployment.success', 'deployment.failed')
 * @param payload The data payload to send
 */
async function fireProjectWebhooks(projectId, event, payload) {
    try {
        const db = admin.firestore();
        const webhooksSnapshot = await db.collection('projects').doc(projectId).collection('webhooks').get();
        if (webhooksSnapshot.empty) {
            return; // No webhooks configured
        }
        const webhooks = webhooksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Filter webhooks that subscribe to this event
        const applicableWebhooks = webhooks.filter(wh => wh.events.includes(event) || wh.events.includes('*'));
        if (applicableWebhooks.length === 0) {
            return;
        }
        const payloadString = JSON.stringify({
            event,
            createdAt: new Date().toISOString(),
            data: payload
        });
        const requests = applicableWebhooks.map(async (webhook) => {
            try {
                // Generate HMAC signature if a secret is provided
                let signature = '';
                if (webhook.secret) {
                    const hmac = crypto_1.default.createHmac('sha256', webhook.secret);
                    hmac.update(payloadString);
                    signature = `sha256=${hmac.digest('hex')}`;
                }
                const headers = {
                    'Content-Type': 'application/json',
                    'User-Agent': 'BravoCloud-Webhook/1.0',
                };
                if (signature) {
                    headers['x-bravocloud-signature'] = signature;
                }
                const response = await fetch(webhook.url, {
                    method: 'POST',
                    headers,
                    body: payloadString,
                    // Set a timeout using AbortController if available in Node 18+
                    signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
                });
                if (!response.ok) {
                    console.error(`[Webhooks] Failed to deliver webhook to ${webhook.url} for event ${event}. Status: ${response.status}`);
                }
                else {
                    console.log(`[Webhooks] Successfully delivered webhook to ${webhook.url} for event ${event}`);
                }
            }
            catch (error) {
                console.error(`[Webhooks] Error delivering webhook to ${webhook.url} for event ${event}:`, error.message);
            }
        });
        // We don't want webhook delivery to block the main thread/request, so we await them but catch all errors inside the map
        await Promise.allSettled(requests);
    }
    catch (err) {
        console.error(`[Webhooks] Internal error processing webhooks for project ${projectId}:`, err);
    }
}
