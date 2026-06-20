"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const middleware_1 = require("../lib/middleware");
const aws_1 = require("../lib/aws");
const router = express_1.default.Router();
// A utility function to strictly remove AWS terminology
function whiteLabelServiceName(awsName) {
    const lowerName = awsName.toLowerCase();
    if (lowerName.includes('elastic compute cloud') || lowerName.includes('ec2')) {
        return 'Cloud Compute Engines';
    }
    if (lowerName.includes('relational database') || lowerName.includes('rds')) {
        return 'Relational Databases';
    }
    if (lowerName.includes('simple storage service') || lowerName.includes('s3')) {
        return 'Object Storage (Blob)';
    }
    if (lowerName.includes('elastic container service') || lowerName.includes('ecs')) {
        return 'Container Orchestration';
    }
    if (lowerName.includes('elastic container registry') || lowerName.includes('ecr')) {
        return 'Container Registry';
    }
    if (lowerName.includes('data transfer') || lowerName.includes('cloudfront')) {
        return 'Edge Network Egress';
    }
    if (lowerName.includes('elasticache') || lowerName.includes('redis')) {
        return 'In-Memory Caching';
    }
    if (lowerName.includes('route 53') || lowerName.includes('route53')) {
        return 'Global DNS Resolution';
    }
    if (lowerName.includes('certificate manager') || lowerName.includes('acm')) {
        return 'SSL/TLS Provisioning';
    }
    if (lowerName.includes('load balancing') || lowerName.includes('elb')) {
        return 'Traffic Load Balancing';
    }
    // Fallback cleanup
    return awsName.replace(/Amazon|AWS|Elastic/gi, '').trim() || 'Miscellaneous Cloud Services';
}
router.get('/', middleware_1.verifyToken, async (req, res) => {
    try {
        const rawUsage = await (0, aws_1.getRealAWSUsage)(req.user.id);
        let totalCost = 0;
        const formattedUsage = rawUsage.map(item => {
            // 1. White-label the service name
            const maskedName = whiteLabelServiceName(item.service);
            // 2. Apply the 10% service charge markup
            const markedUpCost = item.cost * 1.10;
            totalCost += markedUpCost;
            return {
                service: maskedName,
                cost: Number(markedUpCost.toFixed(2))
            };
        });
        res.json({
            success: true,
            currentCycle: {
                total: Number(totalCost.toFixed(2)),
                breakdown: formattedUsage
            }
        });
    }
    catch (error) {
        console.error('Error fetching usage data:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
exports.default = router;
