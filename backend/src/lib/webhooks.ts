import * as admin from 'firebase-admin';
import crypto from 'crypto';

export interface WebhookConfig {
  id: string;
  url: string;
  secret: string;
  events: string[];
  createdAt: string;
}

/**
 * Fires configured webhooks for a project based on the event type.
 * @param projectId The ID of the project
 * @param event The event name (e.g., 'deployment.started', 'deployment.success', 'deployment.failed')
 * @param payload The data payload to send
 */
export async function fireProjectWebhooks(projectId: string, event: string, payload: any) {
  try {
    const db = admin.firestore();
    const webhooksSnapshot = await db.collection('projects').doc(projectId).collection('webhooks').get();
    
    if (webhooksSnapshot.empty) {
      return; // No webhooks configured
    }

    const webhooks = webhooksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WebhookConfig));
    
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
          const hmac = crypto.createHmac('sha256', webhook.secret);
          hmac.update(payloadString);
          signature = `sha256=${hmac.digest('hex')}`;
        }

        const headers: Record<string, string> = {
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
        } else {
          console.log(`[Webhooks] Successfully delivered webhook to ${webhook.url} for event ${event}`);
        }
      } catch (error: any) {
        console.error(`[Webhooks] Error delivering webhook to ${webhook.url} for event ${event}:`, error.message);
      }
    });

    // We don't want webhook delivery to block the main thread/request, so we await them but catch all errors inside the map
    await Promise.allSettled(requests);
    
  } catch (err) {
    console.error(`[Webhooks] Internal error processing webhooks for project ${projectId}:`, err);
  }
}
