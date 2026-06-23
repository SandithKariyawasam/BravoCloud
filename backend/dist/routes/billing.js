"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebase_1 = require("../lib/firebase");
const middleware_1 = require("../lib/middleware");
const monthlyInvoices_1 = require("../jobs/monthlyInvoices");
const router = (0, express_1.Router)();
// GET /api/billing
router.get('/', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userDoc = await firebase_1.db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        const userData = userDoc.data() || {};
        const billingAddress = userData.billingAddress || null;
        const taxId = userData.taxId || null;
        const invoiceSettings = userData.invoiceSettings || null;
        // Fetch Payment Methods
        const cardsSnapshot = await firebase_1.db.collection('users').doc(userId).collection('payment_methods').get();
        const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Fetch Invoices
        const invoicesSnapshot = await firebase_1.db.collection('users').doc(userId).collection('invoices').orderBy('date', 'desc').get();
        const invoices = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json({
            billingAddress,
            taxId,
            invoiceSettings,
            cards,
            invoices
        });
    }
    catch (error) {
        console.error('Error fetching billing data:', error);
        res.status(500).json({ error: error.message });
    }
});
// PATCH /api/billing/address
router.patch('/address', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { billingAddress, taxId } = req.body;
        const updates = {};
        if (billingAddress !== undefined)
            updates.billingAddress = billingAddress;
        if (taxId !== undefined)
            updates.taxId = taxId;
        if (Object.keys(updates).length > 0) {
            await firebase_1.db.collection('users').doc(userId).update(updates);
        }
        res.json({ message: 'Billing info updated', updates });
    }
    catch (error) {
        console.error('Error updating billing info:', error);
        res.status(500).json({ error: error.message });
    }
});
// PATCH /api/billing/invoice-settings
router.patch('/invoice-settings', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { invoiceSettings } = req.body;
        if (invoiceSettings !== undefined) {
            await firebase_1.db.collection('users').doc(userId).update({ invoiceSettings });
        }
        res.json({ message: 'Invoice settings updated', invoiceSettings });
    }
    catch (error) {
        console.error('Error updating invoice settings:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST /api/billing/cards
router.post('/cards', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { cardNumber, expMonth, expYear, cvc, name } = req.body;
        if (!cardNumber || !expMonth || !expYear || !cvc) {
            return res.status(400).json({ error: 'Missing card details' });
        }
        // Mask the card number (keep last 4)
        const last4 = cardNumber.replace(/\D/g, '').slice(-4);
        // Determine brand roughly
        let brand = 'Unknown';
        if (cardNumber.startsWith('4'))
            brand = 'Visa';
        else if (cardNumber.startsWith('5'))
            brand = 'Mastercard';
        else if (cardNumber.startsWith('3'))
            brand = 'Amex';
        const cardsSnapshot = await firebase_1.db.collection('users').doc(userId).collection('payment_methods').get();
        const isFirstCard = cardsSnapshot.empty;
        const newCard = {
            last4,
            brand,
            expMonth,
            expYear,
            name: name || '',
            isDefault: isFirstCard,
            createdAt: new Date().toISOString()
        };
        const docRef = await firebase_1.db.collection('users').doc(userId).collection('payment_methods').add(newCard);
        res.json({ message: 'Card added successfully', card: { id: docRef.id, ...newCard } });
    }
    catch (error) {
        console.error('Error adding card:', error);
        res.status(500).json({ error: error.message });
    }
});
// DELETE /api/billing/cards/:id
router.delete('/cards/:id', middleware_1.verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        await firebase_1.db.collection('users').doc(userId).collection('payment_methods').doc(id).delete();
        res.json({ message: 'Card deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting card:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST /api/billing/admin/trigger-invoices
// Manually triggers the monthly invoice generation for testing
router.post('/admin/trigger-invoices', middleware_1.verifyToken, async (req, res) => {
    try {
        await (0, monthlyInvoices_1.generateMonthlyInvoices)();
        res.json({ message: 'Monthly invoices generated successfully.' });
    }
    catch (error) {
        console.error('Error triggering invoices:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
