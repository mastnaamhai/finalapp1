const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/transpotruck';

async function finalDebug() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db();

        // Find customer
        const customer = await db.collection('customers').findOne({ name: /Bag Industries/i });
        console.log('--- CUSTOMER ---');
        console.log(JSON.stringify(customer, null, 2));

        if (!customer) return;

        // Find ALL invoices for this customer
        const invoices = await db.collection('invoices').find({
            $or: [
                { customer: customer._id },
                { customer: customer._id.toString() }
            ]
        }).toArray();

        console.log(`--- INVOICES FOR ${customer.name} (${invoices.length}) ---`);
        invoices.forEach(inv => {
            console.log(`- Inv #${inv.invoiceNumber}: Total ₹${inv.grandTotal}, Status: ${inv.status}, Payments: ${inv.payments?.length || 0}, Settlements: ${inv.settlements?.length || 0}`);
        });

        // Find ALL payments for this customer
        const payments = await db.collection('payments').find({
            $or: [
                { customer: customer._id },
                { customer: customer._id.toString() }
            ]
        }).toArray();

        console.log(`--- PAYMENTS FOR ${customer.name} (${payments.length}) ---`);
        payments.forEach(p => {
            console.log(`- Pay #${p.paymentNumber}: Amt ₹${p.amount}, TDS ₹${p.tdsAmount || 0}, Type: ${p.type}, Date: ${p.date}`);
        });

        // Search for the 25L+ invoice specifically anywhere in the DB
        const bigInvoices = await db.collection('invoices').find({
            grandTotal: { $gt: 1000000 }
        }).toArray();

        console.log('--- ALL INVOICES > 10L ---');
        for (const inv of bigInvoices) {
            const cust = await db.collection('customers').findOne({ _id: inv.customer });
            console.log(`- Inv #${inv.invoiceNumber}: Total ₹${inv.grandTotal}, Customer: ${cust ? cust.name : 'Unknown'}, Status: ${inv.status}`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

finalDebug();
