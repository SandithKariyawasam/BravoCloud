"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const firebase_1 = require("../lib/firebase");
const middleware_1 = require("../lib/middleware");
const router = express_1.default.Router();
// Helper to calculate percentiles
function percentile(arr, p) {
    if (arr.length === 0)
        return 0;
    arr.sort((a, b) => a - b);
    const index = (p / 100) * (arr.length - 1);
    const lower = Math.floor(index);
    const upper = lower + 1;
    const weight = index % 1;
    if (upper >= arr.length)
        return arr[lower];
    return arr[lower] * (1 - weight) + arr[upper] * weight;
}
// Map the UI metric names to the web-vitals short codes
const METRIC_CODES = {
    "First Contentful Paint": "FCP",
    "Largest Contentful Paint": "LCP",
    "Interaction to Next Paint": "INP",
    "Cumulative Layout Shift": "CLS",
    "First Input Delay": "FID",
    "Time to First Byte": "TTFB"
};
router.get('/:id', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const projectId = req.params.id;
        const requestedMetric = req.query.metric || "Real Experience Score";
        // Verify ownership
        const projectDoc = await firebase_1.db.collection('projects').doc(projectId).get();
        if (!projectDoc.exists)
            return res.status(404).json({ error: 'Project not found' });
        if (projectDoc.data()?.userId !== userId)
            return res.status(403).json({ error: 'Unauthorized' });
        // Fetch Events (Last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const eventsSnapshot = await firebase_1.db.collection('speed_insights_events')
            .where('projectId', '==', projectId)
            .where('timestamp', '>=', sevenDaysAgo.toISOString())
            .get();
        const allEvents = eventsSnapshot.docs.map(doc => doc.data());
        // Generate graph structure (last 7 days)
        const chartData = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            let dayValues = [];
            if (requestedMetric === "Real Experience Score") {
                // Calculate daily RES from all metrics
                const lcpArr = allEvents.filter(e => e.data?.name === 'LCP' && e.timestamp.startsWith(dateStr)).map(e => e.data.value);
                const clsArr = allEvents.filter(e => e.data?.name === 'CLS' && e.timestamp.startsWith(dateStr)).map(e => e.data.value);
                const inpArr = allEvents.filter(e => e.data?.name === 'INP' && e.timestamp.startsWith(dateStr)).map(e => e.data.value);
                const pLcp = percentile(lcpArr, 75);
                const pCls = percentile(clsArr, 75);
                const pInp = percentile(inpArr, 75);
                // Very rough weighting for a synthetic RES score 0-100
                let score = 100;
                if (lcpArr.length) {
                    if (pLcp > 2500)
                        score -= 15;
                    if (pLcp > 4000)
                        score -= 15;
                }
                if (clsArr.length) {
                    if (pCls > 0.1)
                        score -= 15;
                    if (pCls > 0.25)
                        score -= 15;
                }
                if (inpArr.length) {
                    if (pInp > 200)
                        score -= 10;
                    if (pInp > 500)
                        score -= 10;
                }
                if (lcpArr.length === 0 && clsArr.length === 0 && inpArr.length === 0) {
                    score = 0; // No data
                }
                dayValues = score > 0 ? [score] : [];
            }
            else {
                const targetCode = METRIC_CODES[requestedMetric];
                dayValues = allEvents
                    .filter(e => e.data?.name === targetCode && e.timestamp.startsWith(dateStr))
                    .map(e => e.data.value);
            }
            chartData.push({
                date: displayDate,
                value: dayValues.length ? Math.round(percentile(dayValues, 75)) : 0, // Plot P75 on the bar height
                p75: dayValues.length ? Math.round(percentile(dayValues, 75)) : 0,
                p90: dayValues.length ? Math.round(percentile(dayValues, 90)) : 0,
                p95: dayValues.length ? Math.round(percentile(dayValues, 95)) : 0,
                p99: dayValues.length ? Math.round(percentile(dayValues, 99)) : 0,
            });
        }
        // Generate Countries and Thresholds data
        const targetCode = requestedMetric === "Real Experience Score" ? "LCP" : METRIC_CODES[requestedMetric];
        const metricEvents = allEvents.filter(e => e.data?.name === targetCode);
        let poor = 0;
        let needsImprovement = 0;
        let great = 0;
        const countriesCount = {};
        const countriesScore = {};
        metricEvents.forEach(e => {
            const rating = e.data?.rating || 'good'; // 'good', 'needs-improvement', 'poor'
            if (rating === 'poor')
                poor++;
            else if (rating === 'needs-improvement')
                needsImprovement++;
            else
                great++;
            const c = e.country || 'Unknown';
            countriesCount[c] = (countriesCount[c] || 0) + 1;
            if (!countriesScore[c])
                countriesScore[c] = [];
            countriesScore[c].push(e.data.value);
        });
        const topCountries = Object.entries(countriesCount)
            .map(([name, count]) => {
            const vals = countriesScore[name];
            // Calculate P75 for that country, or an RES estimate
            let score = Math.round(percentile(vals, 75));
            if (requestedMetric === "Real Experience Score") {
                score = score > 2500 ? 70 : score > 1500 ? 85 : 98; // fake RES for country list
            }
            return { name, count, score };
        })
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        return res.json({
            chartData,
            thresholds: { poor, needsImprovement, great },
            topCountries
        });
    }
    catch (error) {
        console.error('Error fetching speed insights:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
