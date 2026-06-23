import { Router } from 'express';
import { db } from '../lib/firebase';
import { verifyToken } from '../lib/middleware';

const router = Router();

// GET /api/billing
router.get('/', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data() || {};
    const billingAddress = userData.billingAddress || null;
    const taxId = userData.taxId || null;
    const invoiceSettings = userData.invoiceSettings || null;

    // Fetch Payment Methods
    const cardsSnapshot = await db.collection('users').doc(userId).collection('payment_methods').get();
    const cards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch Invoices
    const invoicesSnapshot = await db.collection('users').doc(userId).collection('invoices').orderBy('date', 'desc').get();
    const invoices = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Seed dummy invoice if none exist
    if (invoices.length === 0) {
      const dummyInvoice = {
        date: new Date().toISOString(),
        amount: 0.00,
        status: 'Paid',
        invoiceNumber: `INV-${Date.now()}`
      };
      await db.collection('users').doc(userId).collection('invoices').add(dummyInvoice);
      invoices.push({ id: 'dummy', ...dummyInvoice });
    }

    res.json({
      billingAddress,
      taxId,
      invoiceSettings,
      cards,
      invoices
    });
  } catch (error: any) {
    console.error('Error fetching billing data:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/billing/address
router.patch('/address', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { billingAddress, taxId } = req.body;
    
    const updates: any = {};
    if (billingAddress !== undefined) updates.billingAddress = billingAddress;
    if (taxId !== undefined) updates.taxId = taxId;

    if (Object.keys(updates).length > 0) {
      await db.collection('users').doc(userId).update(updates);
    }
    
    res.json({ message: 'Billing info updated', updates });
  } catch (error: any) {
    console.error('Error updating billing info:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/billing/invoice-settings
router.patch('/invoice-settings', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { invoiceSettings } = req.body;
    
    if (invoiceSettings !== undefined) {
      await db.collection('users').doc(userId).update({ invoiceSettings });
    }
    
    res.json({ message: 'Invoice settings updated', invoiceSettings });
  } catch (error: any) {
    console.error('Error updating invoice settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/billing/cards
router.post('/cards', verifyToken, async (req: any, res: any) => {
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
    if (cardNumber.startsWith('4')) brand = 'Visa';
    else if (cardNumber.startsWith('5')) brand = 'Mastercard';
    else if (cardNumber.startsWith('3')) brand = 'Amex';

    const cardsSnapshot = await db.collection('users').doc(userId).collection('payment_methods').get();
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

    const docRef = await db.collection('users').doc(userId).collection('payment_methods').add(newCard);
    
    res.json({ message: 'Card added successfully', card: { id: docRef.id, ...newCard } });
  } catch (error: any) {
    console.error('Error adding card:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/billing/cards/:id
router.delete('/cards/:id', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    await db.collection('users').doc(userId).collection('payment_methods').doc(id).delete();
    
    res.json({ message: 'Card deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting card:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
