"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMonthlyInvoices = exports.startMonthlyInvoiceCron = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const firebase_1 = require("../lib/firebase");
const startMonthlyInvoiceCron = () => {
    // Run on the 1st of every month at 00:00 (midnight)
    // "0 0 1 * *"
    node_cron_1.default.schedule('0 0 1 * *', async () => {
        console.log('[CRON] Starting automated monthly invoice generation...');
        try {
            await (0, exports.generateMonthlyInvoices)();
            console.log('[CRON] Monthly invoice generation completed successfully.');
        }
        catch (error) {
            console.error('[CRON] Failed to generate monthly invoices:', error);
        }
    });
};
exports.startMonthlyInvoiceCron = startMonthlyInvoiceCron;
const generateMonthlyInvoices = async () => {
    const usersSnapshot = await firebase_1.db.collection('users').get();
    const promises = usersSnapshot.docs.map(async (userDoc) => {
        const userId = userDoc.id;
        // Base amount for the monthly serverless hosting plan
        const amount = 10.00;
        const newInvoice = {
            date: new Date().toISOString(),
            amount,
            status: 'Paid', // Assuming auto-charge or standard tier
            invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        };
        await firebase_1.db.collection('users').doc(userId).collection('invoices').add(newInvoice);
    });
    await Promise.all(promises);
};
exports.generateMonthlyInvoices = generateMonthlyInvoices;
