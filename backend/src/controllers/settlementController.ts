import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import PaymentModel from '../models/payment';
import InvoiceModel from '../models/invoice';
import Customer from '../models/customer';
import { SettlementService } from '../utils/settlementService';
import { updateInvoiceStatus } from '../utils/invoiceUtils';
import type { Payment, Invoice } from '../types';

/**
 * Recalculate settlements for a specific customer
 * This should be used to fix corrupted ledger data
 */
export const recalculateCustomerSettlements = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;

  console.log(`Recalculating settlements for customer: ${customerId}`);

  // Get all payments and invoices for this customer
  const payments = await PaymentModel.find({
    $or: [
      { customer: customerId },
      { customerId: customerId }
    ]
  }).populate('customer').populate('invoiceId');

  const invoices = await InvoiceModel.find({
    customer: customerId
  }).populate('customer');

  console.log(`Found ${payments.length} payments and ${invoices.length} invoices`);

  // Recalculate settlements
  const { updatedPayments, updatedInvoices } = SettlementService.recalculateSettlements(payments as any[], invoices as any[]);

  // Update database with recalculated data
  const updatePromises: Promise<any>[] = [];

  // Update payments
  updatedPayments.forEach(payment => {
    updatePromises.push(
      PaymentModel.findByIdAndUpdate(payment._id, {
        settlements: payment.settlements,
        unsettledAmount: payment.unsettledAmount
      }, { runValidators: false })
    );
  });

  // Update invoices
  updatedInvoices.forEach(invoice => {
    updatePromises.push(
      InvoiceModel.findByIdAndUpdate(invoice._id, {
        settlements: invoice.settlements,
        settledAmount: invoice.settledAmount,
        outstandingAmount: invoice.outstandingAmount
      }, { runValidators: false })
    );

    // Update invoice status based on settlements
    updatePromises.push(updateInvoiceStatus(invoice._id.toString()));
  });

  await Promise.all(updatePromises);

  console.log(`Successfully recalculated settlements for customer ${customerId}`);

  res.json({
    message: 'Settlements recalculated successfully',
    customerId,
    paymentsUpdated: updatedPayments.length,
    invoicesUpdated: updatedInvoices.length
  });
});

/**
 * Recalculate settlements for all customers
 * This is a heavy operation that should be used carefully
 */
export const recalculateAllSettlements = asyncHandler(async (req: Request, res: Response) => {
  console.log('Starting full settlement recalculation for all customers');

  const customers = await Customer.find({});
  const results: any[] = [];

  for (const customer of customers) {
    try {
      console.log(`Processing customer: ${customer.name} (${customer._id})`);

      // Get payments and invoices for this customer
      const payments = await PaymentModel.find({
        $or: [
          { customer: customer._id },
          { customerId: customer._id.toString() }
        ]
      }).populate('customer').populate('invoiceId');

      const invoices = await InvoiceModel.find({
        customer: customer._id
      }).populate('customer');

      if (payments.length === 0 && invoices.length === 0) {
        console.log(`No transactions for customer ${customer.name}, skipping`);
        continue;
      }

      // Recalculate settlements
      const { updatedPayments, updatedInvoices } = SettlementService.recalculateSettlements(payments as any[], invoices as any[]);

      // Update database
      const updatePromises: Promise<any>[] = [];

      updatedPayments.forEach(payment => {
        updatePromises.push(
          PaymentModel.findByIdAndUpdate(payment._id, {
            settlements: payment.settlements,
            unsettledAmount: payment.unsettledAmount
          }, { runValidators: false })
        );
      });

      updatedInvoices.forEach(invoice => {
        updatePromises.push(
          InvoiceModel.findByIdAndUpdate(invoice._id, {
            settlements: invoice.settlements,
            settledAmount: invoice.settledAmount,
            outstandingAmount: invoice.outstandingAmount
          }, { runValidators: false })
        );
        updatePromises.push(updateInvoiceStatus(invoice._id.toString()));
      });

      await Promise.all(updatePromises);

      results.push({
        customerId: customer._id,
        customerName: customer.name,
        paymentsUpdated: updatedPayments.length,
        invoicesUpdated: updatedInvoices.length,
        success: true
      });

      console.log(`Completed customer ${customer.name}`);

    } catch (error) {
      console.error(`Error processing customer ${customer.name}:`, error);
      results.push({
        customerId: customer._id,
        customerName: customer.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;

  console.log(`Settlement recalculation completed. Success: ${successCount}, Errors: ${errorCount}`);

  res.json({
    message: 'Full settlement recalculation completed',
    totalCustomers: customers.length,
    successful: successCount,
    errors: errorCount,
    results
  });
});

/**
 * Get settlement summary for a customer
 */
export const getCustomerSettlementSummary = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;

  const payments = await PaymentModel.find({
    $or: [
      { customer: customerId },
      { customerId: customerId }
    ]
  });

  const invoices = await InvoiceModel.find({
    customer: customerId
  });

  const totalOutstanding = SettlementService.getTotalOutstandingForCustomer(invoices as any[]);
  const availableAdvances = SettlementService.getAvailableAdvances(payments as any[]);

  const invoiceSummary = invoices.map(invoice => ({
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    grandTotal: invoice.grandTotal,
    settledAmount: invoice.settledAmount || 0,
    outstandingAmount: SettlementService.getOutstandingAmount(invoice as any),
    status: SettlementService.getInvoiceSettlementStatus(invoice as any)
  }));

  res.json({
    customerId,
    totalOutstanding,
    availableAdvances,
    netBalance: totalOutstanding - availableAdvances,
    invoices: invoiceSummary
  });
});
