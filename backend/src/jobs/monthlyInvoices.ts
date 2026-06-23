import cron from 'node-cron';
import { db } from '../lib/firebase';

export const startMonthlyInvoiceCron = () => {
  // Run on the 1st of every month at 00:00 (midnight)
  // "0 0 1 * *"
  cron.schedule('0 0 1 * *', async () => {
    console.log('[CRON] Starting automated monthly invoice generation...');
    try {
      await generateMonthlyInvoices();
      console.log('[CRON] Monthly invoice generation completed successfully.');
    } catch (error) {
      console.error('[CRON] Failed to generate monthly invoices:', error);
    }
  });
};

export const generateMonthlyInvoices = async () => {
  const usersSnapshot = await db.collection('users').get();

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

    await db.collection('users').doc(userId).collection('invoices').add(newInvoice);
  });

  await Promise.all(promises);
};
