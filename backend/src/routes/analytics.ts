import express from 'express';
import { db } from '../lib/firebase';
import { verifyToken } from '../lib/middleware';
import UAParser from 'ua-parser-js';

const router = express.Router();

// 1. Ingestion Endpoint
router.post('/track', async (req: any, res: any) => {
  try {
    const { projectId, type, data, url, path } = req.body;

    if (!projectId || !type) {
      return res.status(400).json({ error: 'Missing projectId or type' });
    }

    // Attempt to verify project exists (could cache this for performance, but good for security)
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Extract User-Agent Data
    const userAgent = req.headers['user-agent'] || '';
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    
    // Determine OS and Device
    const os = result.os.name || 'Unknown OS';
    let deviceType = result.device.type || 'desktop';
    if (deviceType === 'desktop' && result.os.name === 'Mac OS') deviceType = 'desktop'; // Fallback
    if (!result.device.type) {
      if (['Windows', 'Mac OS', 'Linux'].includes(os)) deviceType = 'desktop';
      else if (['iOS', 'Android'].includes(os)) deviceType = 'mobile';
      else deviceType = 'unknown';
    }

    // Extract Location (Country) from Headers (Vercel/Cloudflare)
    const country = req.headers['x-vercel-ip-country'] 
                 || req.headers['cf-ipcountry'] 
                 || req.headers['x-forwarded-country'] 
                 || 'Unknown';

    // Create Event Document
    const event = {
      projectId,
      type,
      data: data || {},
      url: url || '',
      path: path || '/',
      os,
      deviceType,
      country,
      userAgent,
      timestamp: new Date().toISOString()
    };

    await db.collection('analytics_events').add(event);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Failed to track analytics event:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Fetch Analytics for Dashboard
router.get('/:id', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const projectId = req.params.id;

    // Verify ownership
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) return res.status(404).json({ error: 'Project not found' });
    
    if (projectDoc.data()?.userId !== userId) return res.status(403).json({ error: 'Unauthorized' });

    // Fetch Events (Last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const eventsSnapshot = await db.collection('analytics_events')
      .where('projectId', '==', projectId)
      .where('timestamp', '>=', thirtyDaysAgo.toISOString())
      .get();

    let totalVisitors = 0; // Rough estimation (count of unique IPs/Sessions. For now we use total page views as a proxy or if we tracked session IDs)
    let pageViews = 0;
    
    const pathsCount: Record<string, number> = {};
    const countriesCount: Record<string, number> = {};
    const osCount: Record<string, number> = {};
    const deviceCount: Record<string, number> = {};
    const errors: any[] = [];

    // Since we don't have session IDs, we'll estimate visitors by unique user agents per day (very rough)
    const uniqueSessions = new Set<string>();

    eventsSnapshot.docs.forEach(doc => {
      const e = doc.data();
      const dateStr = e.timestamp.split('T')[0];
      const sessionHash = `${dateStr}-${e.userAgent}-${e.country}`;

      if (e.type === 'page_view') {
        pageViews++;
        uniqueSessions.add(sessionHash);

        pathsCount[e.path] = (pathsCount[e.path] || 0) + 1;
        countriesCount[e.country] = (countriesCount[e.country] || 0) + 1;
        osCount[e.os] = (osCount[e.os] || 0) + 1;
        deviceCount[e.deviceType] = (deviceCount[e.deviceType] || 0) + 1;
      } else if (e.type === 'error') {
        errors.push({
          message: e.data.message || 'Unknown Error',
          filename: e.data.filename || '',
          lineno: e.data.lineno || 0,
          url: e.url || '',
          timestamp: e.timestamp,
          os: e.os,
          browser: new UAParser(e.userAgent).getBrowser().name || 'Unknown'
        });
      }
    });

    totalVisitors = uniqueSessions.size;

    // Helper to sort and slice top 10
    const getTop = (record: Record<string, number>) => {
      return Object.entries(record)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    };

    // Sort errors by newest
    errors.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.json({
      metrics: {
        totalVisitors,
        pageViews,
        topPages: getTop(pathsCount),
        topCountries: getTop(countriesCount),
        topOS: getTop(osCount),
        topDevices: getTop(deviceCount),
        errors: errors.slice(0, 20) // Only top 20 recent errors
      }
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Serve Tracking Script
router.get('/script.js', (req: any, res: any) => {
  const apiUrl = process.env.API_URL || 'https://bravo-cloud-ydew.vercel.app'; // Default fallback
  
  const scriptContent = `
    (function() {
      if (window.__bravoAnalyticsInitialized) return;
      window.__bravoAnalyticsInitialized = true;

      // Find the script tag to extract projectId
      var scripts = document.getElementsByTagName('script');
      var projectId = null;
      var endpoint = '${apiUrl}/api/analytics/track';

      for (var i = 0; i < scripts.length; i++) {
        if (scripts[i].getAttribute('data-bravocloud-id')) {
          projectId = scripts[i].getAttribute('data-bravocloud-id');
          break;
        }
      }

      if (!projectId) {
        console.warn('BravoCloud Analytics: Missing data-bravocloud-id on script tag.');
        return;
      }

      function sendEvent(type, data) {
        try {
          var payload = JSON.stringify({
            projectId: projectId,
            type: type,
            data: data || {},
            url: window.location.href,
            path: window.location.pathname
          });

          if (navigator.sendBeacon) {
            var blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon(endpoint, blob);
          } else {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', endpoint, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(payload);
          }
        } catch (e) {
          // Silent failure for analytics
        }
      }

      // Track Initial Page View
      sendEvent('page_view');

      // Track SPA Navigations (History API overrides)
      var pushState = history.pushState;
      history.pushState = function() {
        pushState.apply(history, arguments);
        setTimeout(function() { sendEvent('page_view'); }, 0);
      };
      
      var replaceState = history.replaceState;
      history.replaceState = function() {
        replaceState.apply(history, arguments);
        setTimeout(function() { sendEvent('page_view'); }, 0);
      };

      window.addEventListener('popstate', function() {
        setTimeout(function() { sendEvent('page_view'); }, 0);
      });

      // Track JS Errors ("Failed Features")
      window.addEventListener('error', function(event) {
        sendEvent('error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });

      window.addEventListener('unhandledrejection', function(event) {
        sendEvent('error', {
          message: event.reason ? event.reason.toString() : 'Unhandled Promise Rejection'
        });
      });

    })();
  `;

  res.setHeader('Content-Type', 'application/javascript');
  res.send(scriptContent);
});

export default router;
