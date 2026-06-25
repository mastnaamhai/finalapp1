const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/transpotruck';

async function debugCustomer() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db();

        const customer = await db.collection('customers').findOne({ name: /Bag Industries/i });
        if (!customer) {
            console.log('Customer not found');
            return;
        }

        console.log('Customer:', JSON.stringify(customer, null, 2));

        const invoices = await db.collection('invoices').find({
            $or: [
                { customer: customer._id },
                { customer: customer._id.toString() },
                { customerId: customer._id }, // covering both bases just in case
                { customerId: customer._id.toString() }
            ]
        }).toArray();

        console.log('Invoices count:', invoices.length);
        const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
        console.log('Total Invoiced:', totalInvoiced);

        const payments = await db.collection('payments').find({
            $or: [
                { customer: customer._id },
                { customer: customer._id.toString() },
                { customerId: customer._id },
                { customerId: customer._id.toString() }
            ]
        }).toArray();

        console.log('Payments count:', payments.length);
        const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0) + (p.tdsAmount || 0), 0);
        console.log('Total Paid (including TDS):', totalPaid);

        console.log('Calculated Balance:', totalInvoiced - totalPaid);

        // Let's see some details
        if (invoices.length > 0) {
            console.log('Sample Invoices with balance:');
            invoices.forEach(inv => {
                const paid = (inv.settlements || []).reduce((s, set) => s + set.amount, 0);
                if (inv.grandTotal - paid > 0) {
                    console.log(`- Inv #${inv.invoiceNumber}: Total ₹${inv.grandTotal}, Paid ₹${paid}, Balance ₹${inv.grandTotal - paid}`);
                }
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

debugCustomer();
