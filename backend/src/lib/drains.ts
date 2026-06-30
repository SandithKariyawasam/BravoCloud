import { db } from './firebase';

export async function forwardLogToDrains(userId: string, jobId: string, logMessage: string) {
  try {
    const drainsSnapshot = await db.collection('users').doc(userId).collection('drains').get();
    if (drainsSnapshot.empty) return;

    const timestamp = new Date().toISOString();

    const fetchPromises = drainsSnapshot.docs.map(doc => {
      const drain = doc.data();
      const type = drain.type;
      const url = drain.url;
      const secret = drain.secretToken;

      try {
        if (type === 'webhook') {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (secret) headers['Authorization'] = `Bearer ${secret}`;
          
          return fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              source: 'bravocloud-agent',
              jobId,
              message: logMessage,
              timestamp
            })
          }).catch(e => console.error(`[Drain] Failed to send to custom webhook ${url}`, e.message));
        }

        if (type === 'datadog') {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (secret) headers['DD-API-KEY'] = secret;
          
          return fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify([{
              ddsource: 'bravocloud',
              service: 'agent',
              message: logMessage,
              job_id: jobId
            }])
          }).catch(e => console.error(`[Drain] Failed to send to Datadog`, e.message));
        }

        if (type === 'logtail') {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (secret) headers['Authorization'] = `Bearer ${secret}`;
          
          return fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify([{
              dt: timestamp,
              message: logMessage,
              job_id: jobId,
              source: 'bravocloud'
            }])
          }).catch(e => console.error(`[Drain] Failed to send to Logtail`, e.message));
        }

        if (type === 'syslog') {
          // For Syslog over HTTP
          const headers: Record<string, string> = { 'Content-Type': 'text/plain' };
          if (secret) headers['Authorization'] = `Bearer ${secret}`;
          
          const syslogMessage = `<14>1 ${timestamp} bravocloud agent ${jobId} - - ${logMessage}`;
          return fetch(url, {
            method: 'POST',
            headers,
            body: syslogMessage
          }).catch(e => console.error(`[Drain] Failed to send to Syslog HTTP`, e.message));
        }
      } catch (err) {
        console.error(`[Drain] Error preparing drain request`, err);
      }
    });

    // Fire and forget without blocking
    Promise.all(fetchPromises).catch(e => console.error("Error pushing logs to drains:", e));
  } catch (err) {
    console.error("Error in forwardLogToDrains", err);
  }
}
