const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db();

        // Find Bag Industries
        const customer = await db.collection('customers').findOne({ name: /Bag Industries/i });
        console.log('Customer Found:', customer ? customer.name : 'NONE');
        if (!customer) return;

        console.log('Customer ID:', customer._id.toString());

        // Search for invoices by both ObjectId and String
        const invoices = await db.collection('invoices').find({
            $or: [
                { customer: customer._id },
                { customer: customer._id.toString() }
            ]
        }).toArray();

        console.log('Invoices Count:', invoices.length);

        let totalUnpaid = 0;
        invoices.forEach(inv => {
            const paid = (inv.settlements || []).reduce((s, set) => s + set.amount, 0);
            const balance = inv.grandTotal - paid;
            if (balance > 0) totalUnpaid += balance;
            console.log(`- Inv #${inv.invoiceNumber}: Status ${inv.status}, Balance ₹${balance}, Paid ₹${paid}, Grand Total ₹${inv.grandTotal}`);
        });

        console.log('Total Unpaid Calcuated: ₹' + totalUnpaid);

        // Check for payments
        const payments = await db.collection('payments').find({
            $or: [
                { customer: customer._id },
                { customer: customer._id.toString() },
                { customerId: customer._id },
                { customerId: customer._id.toString() }
            ]
        }).toArray();

        console.log('Payments Count:', payments.length);
        payments.forEach(p => {
            console.log(`- Pay #${p.paymentNumber}: Amt ₹${p.amount}, TDS ₹${p.tdsAmount || 0}, Type ${p.type}`);
        });

    } finally {
        await client.close();
    }
}
run();
