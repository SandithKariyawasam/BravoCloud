import { db } from './firebase';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const region = process.env.AWS_REGION || "us-east-1";
const sesClient = new SESClient({ region });

// Make sure your SES account is out of sandbox, or you have verified the "From" address.
const FROM_EMAIL = process.env.SYSTEM_EMAIL_FROM || "alerts@bravocloud.io";

export async function triggerAlert(userId: string, event: string, payload: any) {
  try {
    const alertsSnapshot = await db.collection('users').doc(userId).collection('alerts').where('event', '==', event).get();
    
    if (alertsSnapshot.empty) return;

    const timestamp = new Date().toISOString();
    
    // Formatting helper
    const buildMessage = () => {
      let title = "";
      let color = "";
      switch (event) {
        case 'deployment_failed':
          title = `Deployment Failed for ${payload.projectName}`;
          color = "#ef4444"; // Red
          break;
        case 'deployment_success':
          title = `Deployment Succeeded for ${payload.projectName}`;
          color = "#22c55e"; // Green
          break;
        case 'agent_offline':
          title = `Agent Offline Warning`;
          color = "#eab308"; // Yellow
          break;
        default:
          title = `BravoCloud Alert: ${event}`;
          color = "#3b82f6"; // Blue
      }
      
      const details = Object.entries(payload)
        .map(([k, v]) => `**${k}**: ${v}`)
        .join('\n');
        
      return { title, color, details };
    };

    const { title, color, details } = buildMessage();

    const dispatchPromises = alertsSnapshot.docs.map(async (doc) => {
      const alert = doc.data();
      
      try {
        if (alert.method === 'slack' || alert.method === 'discord') {
          // Both Slack and Discord accept basic Slack-compatible webhook payloads
          const webhookPayload = {
            attachments: [
              {
                color: color,
                title: title,
                text: `${details}\n\n_Triggered at ${timestamp}_`
              }
            ]
          };

          return fetch(alert.target, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload)
          }).catch((e: any) => console.error(`[Alerts] Failed to send webhook to ${alert.target}`, e.message));
        }

        if (alert.method === 'email') {
          const params = {
            Destination: {
              ToAddresses: [alert.target]
            },
            Message: {
              Body: {
                Text: {
                  Charset: "UTF-8",
                  Data: `${title}\n\n${details}\n\nTriggered at ${timestamp}`
                }
              },
              Subject: {
                Charset: "UTF-8",
                Data: `[BravoCloud] ${title}`
              }
            },
            Source: FROM_EMAIL
          };

          const command = new SendEmailCommand(params);
          return sesClient.send(command).catch((e: any) => console.error(`[Alerts] Failed to send SES email to ${alert.target}`, e.message));
        }
      } catch (err) {
        console.error(`[Alerts] Error processing alert ${doc.id}`, err);
      }
    });

    await Promise.allSettled(dispatchPromises);
  } catch (error) {
    console.error("[Alerts] Error in triggerAlert", error);
  }
}
