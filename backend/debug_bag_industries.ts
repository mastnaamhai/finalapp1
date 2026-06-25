import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/transpotruck';

async function debugCustomer() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const Customer = mongoose.model('Customer', new mongoose.Schema({}, { strict: false }));
        const Invoice = mongoose.model('Invoice', new mongoose.Schema({}, { strict: false }));
        const Payment = mongoose.model('Payment', new mongoose.Schema({}, { strict: false }));

        const customer = await Customer.findOne({ name: /Bag Industries/i });
        if (!customer) {
            console.log('Customer not found');
            return;
        }

        console.log('Customer:', JSON.stringify(customer, null, 2));

        const invoices = await Invoice.find({ customerId: customer._id });
        console.log('Invoices count:', invoices.length);
        const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
        console.log('Total Invoiced:', totalInvoiced);

        const payments = await Payment.find({ customerId: customer._id });
        console.log('Payments count:', payments.length);
        const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0) + (p.tdsAmount || 0), 0);
        console.log('Total Paid (including TDS):', totalPaid);

        console.log('Calculated Balance:', totalInvoiced - totalPaid);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugCustomer();
