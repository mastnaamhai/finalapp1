import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import Invoice from '../models/invoice';
import LorryReceipt from '../models/lorryReceipt';
import NumberingConfig from '../models/numbering';
import { LorryReceiptStatus, InvoiceStatus } from '../types';
import { paginationQuerySchema, createInvoiceSchema, updateInvoiceSchema } from '../utils/validation';
import mongoose from 'mongoose';

// Helper function to calculate total charges from LRs (includes freight + all auxiliary charges)
const calculateTotalChargesFromLrs = async (lrIds: string[]): Promise<{ totalCharges: number; hasZeroFreight: boolean }> => {
  const lrs = await LorryReceipt.find({ _id: { $in: lrIds } });
  let totalChargesSum = 0;
  let hasZeroFreight = false;
  
  lrs.forEach(lr => {
    // Calculate total charges for this LR
    const lrTotal = (lr.charges?.freight || 0) +
                        (lr.charges?.aoc || 0) + 
                        (lr.charges?.hamali || 0) + 
                        (lr.charges?.bCh || 0) + 
                        (lr.charges?.trCh || 0) + 
                        (lr.charges?.detentionCh || 0);
    
    if (lrTotal > 0) {
      totalChargesSum += lrTotal;
    } else {
      hasZeroFreight = true;
    }
  });
  
  return { totalCharges: totalChargesSum, hasZeroFreight };
};

export const getInvoices = asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20' } = paginationQuerySchema.parse(req.query);

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const items = await Invoice.find()
    .populate('customer')
    .populate({
      path: 'lorryReceipts',
      populate: [
        { path: 'consignor' },
        { path: 'consignee' }
      ]
    })
    .populate('payments')
    .sort({ invoiceNumber: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Invoice.countDocuments();

  res.json({ items, total, page: pageNum, limit: limitNum });
});

export const getInvoiceById = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('customer')
    .populate({
      path: 'lorryReceipts',
      populate: [
        { path: 'consignor' },
        { path: 'consignee' }
      ]
    })
    .populate('payments');

  if (invoice) {
    res.json(invoice);
  } else {
    res.status(404);
    throw new Error('Invoice not found');
  }
});

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  try {
    console.log('=== INVOICE CREATION START ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    
    // Transform frontend data format to backend format before validation
    console.log('Original customerId:', req.body.customerId);
    console.log('Original customer:', req.body.customer);
    console.log('Original lorryReceipts:', req.body.lorryReceipts);
    
    const transformedData = {
      ...req.body,
      customer: req.body.customerId || req.body.customer,
      lorryReceipts: req.body.lorryReceipts?.map((lr: any) => lr._id || lr) || req.body.lorryReceipts,
    };
    
    // Remove frontend-specific fields
    delete transformedData.customerId;
    
    console.log('Transformed data:', JSON.stringify(transformedData, null, 2));
    console.log('Transformed customer:', transformedData.customer);
    console.log('Transformed lorryReceipts:', transformedData.lorryReceipts);
    
    // Check database connection
    console.log('Database connection state:', mongoose.connection.readyState);
    console.log('Database name:', mongoose.connection.name);
    
    console.log('About to validate with schema...');
    let invoiceData;
    try {
      invoiceData = createInvoiceSchema.parse(transformedData);
      console.log('Validation successful! Validated data:', JSON.stringify(invoiceData, null, 2));
    } catch (validationError) {
      console.error('Validation failed:', validationError);
      console.error('Validation error details:', JSON.stringify(validationError, null, 2));
      throw validationError;
    }

    // Explicitly preserve bookingCharges since Zod validation strips it
    if (transformedData.bookingCharges !== undefined) {
      invoiceData.bookingCharges = transformedData.bookingCharges;
      console.log('Preserved bookingCharges:', invoiceData.bookingCharges);
    }
    
    // Calculate total charges from selected LRs
    const { totalCharges, hasZeroFreight } = await calculateTotalChargesFromLrs(invoiceData.lorryReceipts);
    console.log('Calculated total charges from LRs:', totalCharges);
    console.log('Has zero freight LRs:', hasZeroFreight);
    
    // Check if manual freight override is provided
    const manualFreightAmount = invoiceData.freightCharges?.amount || 0;
    const useManualFreight = manualFreightAmount > 0;

    // Total taxable amount is sum of LRs + booking charges (or manual override)
    const lrTaxableTotal = useManualFreight ? manualFreightAmount : totalCharges;
    const finalTaxableTotal = lrTaxableTotal + (invoiceData.bookingCharges || 0);
    
    console.log('Manual freight amount:', manualFreightAmount);
    console.log('Using manual freight:', useManualFreight);
    console.log('Final taxable total:', finalTaxableTotal);
    console.log('Booking charges in invoiceData:', invoiceData.bookingCharges);

    // Use custom Invoice number if provided, otherwise generate one
    let invoiceNumber = invoiceData.invoiceNumber;
    let config = await NumberingConfig.findOne({ type: 'invoice' });
    if (!invoiceNumber) {
      if (!config) {
        // Initialize numbering config for invoice if it doesn't exist
        config = await NumberingConfig.create({
          type: 'invoice',
          startingNumber: 1001,
          currentNumber: 1001,
          prefix: 'INV'
        });
        console.log('Created new invoice numbering config');
      }

      invoiceNumber = config.currentNumber;
      config.currentNumber = config.currentNumber + 1;
      await config.save();
      console.log('Generated Invoice number:', invoiceNumber);
    } else {
      // Validate manual entry for uniqueness
      const existingInvoice = await Invoice.findOne({ invoiceNumber });
      if (existingInvoice) {
        res.status(400).json({
          message: 'Invoice number already exists. Please enter a different number.'
        });
        return;
      }
      console.log('Using custom Invoice number:', invoiceNumber);

      // Update current number if manual number is higher
      if (config) {
        config.currentNumber = Math.max(config.currentNumber, invoiceNumber + 1);
        await config.save();
      }
    }
    
    // Ensure all required fields are present
    const invoiceToCreate = {
      ...invoiceData,
      invoiceNumber,
      status: InvoiceStatus.UNPAID,
      // Ensure these fields have default values if not provided
      isRcm: invoiceData.isRcm || false,
      isManualGst: invoiceData.isManualGst || false,
      remarks: invoiceData.remarks || '',
      // Auto-calculated freight fields
      isAutoFreightCalculated: !useManualFreight,
      invoiceFreightTotal: finalTaxableTotal,
      // CRITICAL FIX: Ensure totalAmount used for GST calculation matches the final total
      totalAmount: finalTaxableTotal,
    };
    
    console.log('Invoice to create:', JSON.stringify(invoiceToCreate, null, 2));
    console.log('Booking charges in invoiceToCreate:', invoiceToCreate.bookingCharges);

    console.log('Creating new Invoice instance...');
    const invoice = new Invoice(invoiceToCreate);
    console.log('Invoice instance created');

    console.log('Saving invoice to database...');
    const createdInvoice = await invoice.save();
    console.log('Invoice saved successfully:', createdInvoice._id);
    
    // Populate the created invoice before sending response
    const populatedInvoice = await Invoice.findById(createdInvoice._id)
      .populate('customer')
      .populate({
        path: 'lorryReceipts',
        populate: [
          { path: 'consignor' },
          { path: 'consignee' },
        ]
      });
    console.log('Populated Invoice:', populatedInvoice?._id);

    // Update status of associated lorry receipts (Do NOT update charges, as requested)
    if (invoiceData.lorryReceipts && invoiceData.lorryReceipts.length > 0) {
      await LorryReceipt.updateMany(
        { _id: { $in: invoiceData.lorryReceipts } },
        { $set: { status: LorryReceiptStatus.INVOICED } }
      );
      console.log('Updated LR statuses for invoice');
    }

    res.status(201).json(populatedInvoice || createdInvoice);
  } catch (error) {
    console.error('=== INVOICE CREATION ERROR ===');
    console.error('Error type:', typeof error);
    console.error('Error name:', error instanceof Error ? error.name : 'Unknown');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Full error object:', JSON.stringify(error, null, 2));
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Handle validation errors specifically
    if (error instanceof Error && error.name === 'ValidationError') {
      const validationErrors: { [key: string]: string[] } = {};
      if ((error as any).errors) {
        Object.keys((error as any).errors).forEach(key => {
          validationErrors[key] = [(error as any).errors[key].message];
        });
      }
      
      res.status(400).json({
        message: 'Validation failed',
        errors: {
          fieldErrors: validationErrors
        }
      });
      return;
    }
    
    // Handle Zod validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      const zodErrors: { [key: string]: string[] } = {};
      if ((error as any).issues) {
        (error as any).issues.forEach((issue: any) => {
          const field = issue.path.join('.');
          if (!zodErrors[field]) zodErrors[field] = [];
          zodErrors[field].push(issue.message);
        });
      }
      
      res.status(400).json({
        message: 'Validation failed',
        errors: {
          fieldErrors: zodErrors
        }
      });
      return;
    }
    
    res.status(500).json({ 
      message: 'Failed to create invoice', 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    });
  }
});

export const updateInvoice = asyncHandler(async (req: Request, res: Response) => {
  // Transform frontend data format to backend format before validation
  const transformedData = {
    ...req.body,
    customer: req.body.customerId || req.body.customer,
    lorryReceipts: req.body.lorryReceipts?.map((lr: any) => lr._id || lr) || req.body.lorryReceipts,
  };

  // Remove frontend-specific fields
  delete transformedData.customerId;

  const invoiceData = updateInvoiceSchema.parse(transformedData);

  // Explicitly preserve bookingCharges since Zod validation strips it
  if (transformedData.bookingCharges !== undefined) {
    invoiceData.bookingCharges = transformedData.bookingCharges;
  }

  const invoice = await Invoice.findById(req.params.id);

  if (invoice) {
    const originalLrIds = invoice.lorryReceipts.map(lr => lr.toString());

    // Calculate freight total if LRs are being updated
    if (invoiceData.lorryReceipts) {
      const { totalCharges } = await calculateTotalChargesFromLrs(invoiceData.lorryReceipts);
      invoiceData.isAutoFreightCalculated = true;
      invoiceData.invoiceFreightTotal = totalCharges;
      // Update totalAmount to match new LR sum + booking charges
      invoiceData.totalAmount = totalCharges + (invoiceData.bookingCharges || invoice.bookingCharges || 0);
    } else if (invoiceData.bookingCharges !== undefined) {
      // If only booking charges were updated, recalculate totalAmount
      const { totalCharges } = await calculateTotalChargesFromLrs(invoice.lorryReceipts.map(lr => lr.toString()));
      invoiceData.totalAmount = totalCharges + invoiceData.bookingCharges;
    }

    Object.assign(invoice, invoiceData);
    const updatedInvoice = await invoice.save();

    const newLrIds = updatedInvoice.lorryReceipts.map(lr => lr.toString());

    // Update status of newly associated lorry receipts
    const toInvoice = newLrIds.filter(id => !originalLrIds.includes(id));
    if (toInvoice.length > 0) {
      await LorryReceipt.updateMany(
        { _id: { $in: toInvoice } },
        { $set: { status: LorryReceiptStatus.INVOICED } }
      );
    }

    // LRs to be marked as created (or other status)
    const toUnInvoice = originalLrIds.filter(id => !newLrIds.includes(id));
    if (toUnInvoice.length > 0) {
      await LorryReceipt.updateMany(
        { _id: { $in: toUnInvoice } },
        { $set: { status: LorryReceiptStatus.CREATED } } // Or whatever default status is appropriate
      );
    }

    res.json(updatedInvoice);
  } else {
    res.status(404);
    throw new Error('Invoice not found');
  }
});

export const deleteInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await Invoice.findById(req.params.id);

  if (invoice) {
    if (invoice.payments && invoice.payments.length > 0) {
      res.status(400);
      throw new Error('Cannot delete an invoice with payments.');
    }

    const lrIds = invoice.lorryReceipts.map(lr => lr.toString());

    await invoice.deleteOne();

    // Update status of associated lorry receipts
    await LorryReceipt.updateMany(
      { _id: { $in: lrIds } },
      { $set: { status: LorryReceiptStatus.CREATED } } // Or whatever default status is appropriate
    );

    res.json({ message: 'Invoice removed' });
  } else {
    res.status(404);
    throw new Error('Invoice not found');
  }
});
