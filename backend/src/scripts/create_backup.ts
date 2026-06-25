import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import Customer from '../models/customer';
import LorryReceipt from '../models/lorryReceipt';
import Invoice from '../models/invoice';
import TruckHiringNote from '../models/truckHiringNote';
import Payment from '../models/payment';
import NumberingConfig from '../models/numbering';
import CompanyInfo from '../models/companyInfo';
import BankAccount from '../models/bankAccount';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://bharatc711:admin123@cluster0.jgoevfm.mongodb.net/?appName=Cluster0';

async function backup() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    const customers = await Customer.find({});
    const lorryReceipts = await LorryReceipt.find({});
    const invoices = await Invoice.find({});
    const truckHiringNotes = await TruckHiringNote.find({});
    const payments = await Payment.find({});
    const numberingConfigs = await NumberingConfig.find({});
    const companyInfo = await CompanyInfo.find({});
    const bankAccounts = await BankAccount.find({});

    const backupData = {
      customers,
      lorryReceipts,
      invoices,
      truckHiringNotes,
      payments,
      numberingConfigs,
      companyInfo,
      bankAccounts,
    };

    const backupPath = path.join(__dirname, '../../db_backup.json');
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    
    console.log(`Backup completed successfully. Saved to ${backupPath}`);
    process.exit(0);
  } catch (error) {
    console.error('Backup failed:', error);
    process.exit(1);
  }
}

backup();
