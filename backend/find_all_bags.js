const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db();

        const customers = await db.collection('customers').find({ name: /Bag Industries/i }).toArray();
        console.log(`Checking ${customers.length} duplicate customers...`);

        const ids = customers.map(c => c._id);
        const idStrings = customers.map(c => c._id.toString());

        const invoices = await db.collection('invoices').find({
            $or: [
                { customer: { $in: ids } },
                { customer: { $in: idStrings } }
            ]
        }).toArray();

        console.log(`Found a total of ${invoices.length} invoices across all Bag Industries records.`);

        let grandTotalAll = 0;
        let balanceAll = 0;

        invoices.forEach(inv => {
            const paid = (inv.settlements || []).reduce((sum, s) => sum + s.amount, 0);
            const balance = (inv.grandTotal || 0) - paid;
            grandTotalAll += (inv.grandTotal || 0);
            balanceAll += balance;

            if (balance > 0) {
                console.log(`Inv #${inv.invoiceNumber}: Total ₹${inv.grandTotal}, Paid ₹${paid}, Balance ₹${balance}, Status: ${inv.status}`);
            }
        });

        console.log(`\nConsolidated Summary:`);
        console.log(`Total Invoiced Amount: ₹${grandTotalAll}`);
        console.log(`Total Pending Balance: ₹${balanceAll}`);

        const payments = await db.collection('payments').find({
            $or: [
                { customer: { $in: ids } },
                { customer: { $in: idStrings } },
                { customerId: { $in: ids } },
                { customerId: { $in: idStrings } }
            ]
        }).toArray();

        console.log(`\nFound ${payments.length} payment records across all IDs:`);
        payments.forEach(p => {
            console.log(`Pay #${p.paymentNumber}: Amt ₹${p.amount}, TDS ₹${p.tdsAmount || 0}, Date ${p.date}, Type ${p.type}`);
        });

    } finally {
        await client.close();
    }
}
run();
