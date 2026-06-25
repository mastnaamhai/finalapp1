const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db();

        console.log('Searching for invoices > 1,000,000...');
        const invoices = await db.collection('invoices').find({
            grandTotal: { $gt: 1000000 }
        }).toArray();

        console.log('Found Invoices Count:', invoices.length);

        for (const inv of invoices) {
            const customer = await db.collection('customers').findOne({ _id: inv.customer });
            console.log(`- Inv #${inv.invoiceNumber}: Total ₹${inv.grandTotal}, Status: ${inv.status}, Customer: ${customer ? customer.name : 'ID ' + inv.customer}`);
        }

        console.log('\nSearching for customers with "Bag" in name...');
        const bags = await db.collection('customers').find({ name: /Bag/i }).toArray();
        bags.forEach(c => console.log(`- ID: ${c._id}, Name: "${c.name}"`));

    } finally {
        await client.close();
    }
}
run();
