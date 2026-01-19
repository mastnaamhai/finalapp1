import express, { Request, Response } from 'express';
import NumberingConfig from '../models/numbering';
import Invoice from '../models/invoice';
import LorryReceipt from '../models/lorryReceipt';
import TruckHiringNote from '../models/truckHiringNote';

const router = express.Router();

// Get all numbering configurations
router.get('/configs', async (req: Request, res: Response) => {
  try {
    let configs = await NumberingConfig.find({});

    // If no configs exist, create default ones with synced current numbers
    if (configs.length === 0) {
      // Get max numbers from existing records
      const [maxInvoice] = await Invoice.aggregate([
        { $group: { _id: null, maxNumber: { $max: '$invoiceNumber' } } }
      ]);

      const [maxLr] = await LorryReceipt.aggregate([
        { $group: { _id: null, maxNumber: { $max: '$lrNumber' } } }
      ]);

      const [maxThn] = await TruckHiringNote.aggregate([
        { $group: { _id: null, maxNumber: { $max: '$thnNumber' } } }
      ]);

      const invoiceMax = maxInvoice?.maxNumber || 0;
      const lrMax = maxLr?.maxNumber || 0;
      const thnMax = maxThn?.maxNumber || 0;

      // Create default configs
      const defaultConfigs = [
        {
          type: 'invoice' as const,
          startingNumber: 1001,
          currentNumber: Math.max(1001, invoiceMax + 1),
          prefix: 'INV',
        },
        {
          type: 'consignment' as const,
          startingNumber: 5001,
          currentNumber: Math.max(5001, lrMax + 1),
          prefix: 'LR',
        },
        {
          type: 'truckHiringNoteId' as const,
          startingNumber: 2001,
          currentNumber: Math.max(2001, thnMax + 1),
          prefix: 'THN',
        },
      ];

      configs = await NumberingConfig.insertMany(defaultConfigs);
    }

    res.json(configs);
  } catch (error) {
    console.error('Error fetching numbering configs:', error);
    res.status(500).json({ message: 'Error fetching numbering configs' });
  }
});

// Create or update numbering configuration
router.post('/configs', async (req: Request, res: Response) => {
  try {
    const { type, startingNumber, prefix } = req.body;
    
    if (!type || typeof startingNumber !== 'number') {
      return res.status(400).json({ message: 'Invalid configuration data' });
    }

    if (!['invoice', 'consignment', 'truckHiringNoteId'].includes(type)) {
      return res.status(400).json({ message: 'Invalid type. Must be invoice, consignment, or truckHiringNoteId' });
    }

    const existingConfig = await NumberingConfig.findOne({ type });
    
    if (existingConfig) {
      existingConfig.startingNumber = startingNumber;
      existingConfig.currentNumber = startingNumber;
      existingConfig.prefix = prefix || '';
      await existingConfig.save();
      res.json(existingConfig);
    } else {
      const newConfig = await NumberingConfig.create({
        type,
        startingNumber,
        currentNumber: startingNumber,
        prefix: prefix || '',
      });
      res.status(201).json(newConfig);
    }
  } catch (error) {
    console.error('Error saving numbering config:', error);
    res.status(500).json({ message: 'Error saving numbering config' });
  }
});

// Update current number
router.post('/update-current', async (req: Request, res: Response) => {
  try {
    const { type, currentNumber } = req.body;
    
    if (!type || typeof currentNumber !== 'number') {
      return res.status(400).json({ message: 'Invalid data' });
    }

    const config = await NumberingConfig.findOne({ type });
    if (!config) {
      return res.status(404).json({ message: 'Configuration not found' });
    }

    config.currentNumber = currentNumber;
    await config.save();
    
    res.json(config);
  } catch (error) {
    console.error('Error updating current number:', error);
    res.status(500).json({ message: 'Error updating current number' });
  }
});

// Check for duplicate numbers
router.post('/check-duplicate', async (req: Request, res: Response) => {
  try {
    const { type, number } = req.body;
    
    if (!type || typeof number !== 'number') {
      return res.status(400).json({ message: 'Invalid data' });
    }

    let isDuplicate = false;

    if (type === 'invoice') {
      const existingInvoice = await Invoice.findOne({ invoiceNumber: number });
      isDuplicate = !!existingInvoice;
    } else if (type === 'consignment') {
      const existingLr = await LorryReceipt.findOne({ lrNumber: number });
      isDuplicate = !!existingLr;
    } else if (type === 'truckHiringNoteId') {
      const existingThn = await TruckHiringNote.findOne({ thnNumber: number });
      isDuplicate = !!existingThn;
    }

    res.json({ isDuplicate });
  } catch (error) {
    console.error('Error checking duplicate number:', error);
    res.status(500).json({ message: 'Error checking duplicate number' });
  }
});

// Get next number for a type
router.get('/next/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;

    if (!['invoice', 'consignment', 'truckHiringNoteId'].includes(type)) {
      return res.status(400).json({ message: 'Invalid type' });
    }

    const config = await NumberingConfig.findOne({ type });

    if (!config) {
      return res.status(404).json({ message: 'Configuration not found' });
    }

    const nextNumber = config.currentNumber;

    // Update current number
    config.currentNumber = nextNumber + 1;
    await config.save();

    res.json({
      number: nextNumber,
      currentNumber: config.currentNumber
    });
  } catch (error) {
    console.error('Error getting next number:', error);
    res.status(500).json({ message: 'Error getting next number' });
  }
});

// Sync current numbers based on existing records
router.post('/sync-current', async (req: Request, res: Response) => {
  try {
    // Get max numbers from existing records
    const [maxInvoice] = await Invoice.aggregate([
      { $group: { _id: null, maxNumber: { $max: '$invoiceNumber' } } }
    ]);

    const [maxLr] = await LorryReceipt.aggregate([
      { $group: { _id: null, maxNumber: { $max: '$lrNumber' } } }
    ]);

    const [maxThn] = await TruckHiringNote.aggregate([
      { $group: { _id: null, maxNumber: { $max: '$thnNumber' } } }
    ]);

    const updates = [];

    // Update invoice config
    const invoiceMax = maxInvoice?.maxNumber || 0;
    const invoiceConfig = await NumberingConfig.findOne({ type: 'invoice' });
    if (invoiceConfig) {
      const newCurrent = Math.max(invoiceConfig.currentNumber, invoiceMax + 1);
      invoiceConfig.currentNumber = newCurrent;
      updates.push(invoiceConfig.save());
    }

    // Update consignment config
    const lrMax = maxLr?.maxNumber || 0;
    const lrConfig = await NumberingConfig.findOne({ type: 'consignment' });
    if (lrConfig) {
      const newCurrent = Math.max(lrConfig.currentNumber, lrMax + 1);
      lrConfig.currentNumber = newCurrent;
      updates.push(lrConfig.save());
    }

    // Update THN config
    const thnMax = maxThn?.maxNumber || 0;
    const thnConfig = await NumberingConfig.findOne({ type: 'truckHiringNoteId' });
    if (thnConfig) {
      const newCurrent = Math.max(thnConfig.currentNumber, thnMax + 1);
      thnConfig.currentNumber = newCurrent;
      updates.push(thnConfig.save());
    }

    await Promise.all(updates);

    res.json({ message: 'Current numbers synced successfully' });
  } catch (error) {
    console.error('Error syncing current numbers:', error);
    res.status(500).json({ message: 'Error syncing current numbers' });
  }
});

export default router;
