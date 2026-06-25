const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/transpotruck';

async function listAll() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db();

        const customers = await db.collection('customers').find({}).toArray();
        console.log('--- ALL CUSTOMERS ---');
        customers.forEach(c => {
            console.log(`ID: ${c._id}, Name: "${c.name}"`);
        });

        const invoices = await db.collection('invoices').find({ grandTotal: { $gt: 2000000 } }).toArray();
        console.log('--- LARGE INVOICES ---');
        invoices.forEach(i => {
            console.log(`Inv: ${i.invoiceNumber}, CustID: ${i.customer}, Total: ${i.grandTotal}, Status: ${i.status}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

listAll();
