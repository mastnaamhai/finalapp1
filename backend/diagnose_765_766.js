const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/transpotruck';

async function diagnose() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db();

        console.log('--- INVOICES 765 & 766 ---');
        const invoices = await db.collection('invoices').find({
            invoiceNumber: { $in: [765, 766] }
        }).toArray();

        for (const inv of invoices) {
            console.log(`Invoice: ${inv.invoiceNumber}, ID: ${inv._id}, Customer: ${inv.customer}, Total: ${inv.grandTotal}, Status: ${inv.status}`);
            const payments = await db.collection('payments').find({
                $or: [
                    { invoiceId: inv._id },
                    { 'settlements.invoiceId': inv._id }
                ]
            }).toArray();
            console.log(`  Payments found: ${payments.length}`);
            payments.forEach(p => {
                console.log(`    Payment ID: ${p._id}, Amount: ${p.amount}, Type: ${p.type}, Date: ${p.date}, CustomerID: ${p.customer}, Settlements: ${JSON.stringify(p.settlements)}`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

diagnose();
