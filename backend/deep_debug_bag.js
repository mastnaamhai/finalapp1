const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/transpotruck';

async function deepDebug() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db();

        // 1. Find all customers that contain "Bag" or "Industries"
        const customers = await db.collection('customers').find({
            $or: [
                { name: /Bag/i },
                { name: /Industries/i }
            ]
        }).toArray();

        console.log(`Found ${customers.length} potential customer matches:`);
        customers.forEach(c => console.log(`- ID: ${c._id}, Name: "${c.name}"`));

        if (customers.length === 0) return;

        const customerIds = customers.map(c => c._id);
        const customerIdStrings = customers.map(c => c._id.toString());

        // 2. Find ALL invoices for these customers
        const invoices = await db.collection('invoices').find({
            $or: [
                { customer: { $in: customerIds } },
                { customer: { $in: customerIdStrings } },
                { customerId: { $in: customerIds } },
                { customerId: { $in: customerIdStrings } }
            ]
        }).toArray();

        console.log(`\nFound ${invoices.length} invoices for these customers:`);
        let totalUnpaid = 0;
        invoices.forEach(inv => {
            const settlements = inv.settlements || [];
            const settledAmt = settlements.reduce((sum, s) => sum + s.amount, 0);
            const balance = inv.grandTotal - settledAmt;
            if (balance > 0) totalUnpaid += balance;

            console.log(`- Inv #${inv.invoiceNumber}: Status ${inv.status}, Total ₹${inv.grandTotal}, Settled ₹${settledAmt}, Balance ₹${balance}`);
            console.log(`  Payments Array: ${JSON.stringify(inv.payments || [])}`);
            console.log(`  Settlements: ${JSON.stringify(settlements)}`);
        });
        console.log(`\nTotal Calculate Balance for these customers: ₹${totalUnpaid}`);

        // 3. Find ALL payments for these customers
        const payments = await db.collection('payments').find({
            $or: [
                { customer: { $in: customerIds } },
                { customer: { $in: customerIdStrings } },
                { customerId: { $in: customerIds } },
                { customerId: { $in: customerIdStrings } }
            ]
        }).toArray();

        console.log(`\nFound ${payments.length} payment records:`);
        payments.forEach(p => {
            console.log(`- Pay #${p.paymentNumber}: Type ${p.type}, Amount ₹${p.amount}, TDS ₹${p.tdsAmount || 0}, Date ${p.date}`);
            console.log(`  Settlements: ${JSON.stringify(p.settlements || [])}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

deepDebug();
