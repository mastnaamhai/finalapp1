import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import Customer from '../models/customer';
import LorryReceipt from '../models/lorryReceipt';
import Invoice from '../models/invoice';
import Payment from '../models/payment';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://bharatc711:admin123@cluster0.jgoevfm.mongodb.net/?appName=Cluster0';

async function deduplicateClients() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to database.');

    const allCustomers = await Customer.find({}).lean();
    console.log(`Found ${allCustomers.length} total customers.`);

    // Group customers by normalized name
    const groupedCustomers: { [name: string]: any[] } = {};
    for (const customer of allCustomers) {
      const name = customer.name.trim().toLowerCase();
      if (!groupedCustomers[name]) {
        groupedCustomers[name] = [];
      }
      groupedCustomers[name].push(customer);
    }

    let deletedCount = 0;
    let updatedLrs = 0;
    let updatedInvoices = 0;
    let updatedPayments = 0;

    for (const [name, duplicates] of Object.entries(groupedCustomers)) {
      if (duplicates.length > 1) {
        console.log(`\nFound ${duplicates.length} duplicates for name: "${name}"`);
        
        // Pick canonical customer
        // Preference 1: Has GSTIN
        // Preference 2: Longest populated fields
        // Preference 3: First created
        const sorted = duplicates.sort((a, b) => {
          if (a.gstin && !b.gstin) return -1;
          if (!a.gstin && b.gstin) return 1;
          
          const aKeys = Object.values(a).filter(v => v).length;
          const bKeys = Object.values(b).filter(v => v).length;
          return bKeys - aKeys;
        });

        const canonical = sorted[0];
        const duplicatesToRemove = sorted.slice(1);
        const duplicateIds = duplicatesToRemove.map(d => d._id);

        console.log(`Canonical ID: ${canonical._id} | GSTIN: ${canonical.gstin || 'None'}`);
        console.log(`Duplicate IDs to remove: ${duplicateIds.join(', ')}`);

        // Merge any missing fields from duplicates into canonical
        const updateData: any = {};
        let needsUpdate = false;
        for (const dup of duplicatesToRemove) {
          for (const [key, value] of Object.entries(dup)) {
            if (key !== '_id' && key !== '__v' && value) {
              if (!canonical[key] || (key === 'gstin' && !canonical.gstin)) {
                updateData[key] = value;
                canonical[key] = value;
                needsUpdate = true;
              }
            }
          }
        }

        if (needsUpdate) {
          console.log(`Updating canonical customer with missing fields...`);
          await Customer.findByIdAndUpdate(canonical._id, { $set: updateData });
        }

        // Update references
        const lrConsignorRes = await LorryReceipt.updateMany(
          { consignor: { $in: duplicateIds } },
          { $set: { consignor: canonical._id } }
        );
        const lrConsigneeRes = await LorryReceipt.updateMany(
          { consignee: { $in: duplicateIds } },
          { $set: { consignee: canonical._id } }
        );
        updatedLrs += lrConsignorRes.modifiedCount + lrConsigneeRes.modifiedCount;

        const invRes = await Invoice.updateMany(
          { customer: { $in: duplicateIds } },
          { $set: { customer: canonical._id } }
        );
        updatedInvoices += invRes.modifiedCount;

        const payRes = await Payment.updateMany(
          { customer: { $in: duplicateIds } },
          { $set: { customer: canonical._id } }
        );
        updatedPayments += payRes.modifiedCount;

        // Delete duplicates
        const delRes = await Customer.deleteMany({ _id: { $in: duplicateIds } });
        deletedCount += delRes.deletedCount;
        
        console.log(`Deleted ${delRes.deletedCount} duplicates.`);
      }
    }

    console.log('\n--- Deduplication Summary ---');
    console.log(`Total customers deleted: ${deletedCount}`);
    console.log(`Total LorryReceipts updated: ${updatedLrs}`);
    console.log(`Total Invoices updated: ${updatedInvoices}`);
    console.log(`Total Payments updated: ${updatedPayments}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Deduplication failed:', error);
    process.exit(1);
  }
}

deduplicateClients();
