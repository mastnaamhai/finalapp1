import type { 
  Customer, 
  Invoice, 
  Payment, 
  TruckHiringNote
} from '../types';
import { PaymentType, PaymentMode } from '../types';
import type { 
  LedgerTransaction, 
  ClientLedgerEntry, 
  CompanyLedgerEntry, 
  ClientLedgerData, 
  CompanyLedgerData,
  LedgerSummary,
  LedgerFilters
} from '../types/ledger';

export class LedgerService {
  /**
   * Generate client ledger data for a specific customer with proper invoice-wise settlement
   */
  static generateClientLedger(
    customerId: string,
    customer: Customer,
    invoices: Invoice[],
    payments: Payment[],
    truckHiringNotes: TruckHiringNote[],
    filters?: LedgerFilters
  ): ClientLedgerData {
    console.log('=== Enhanced Client Ledger Generation ===');
    console.log('Customer ID:', customerId, 'Name:', customer.name);

    const startDate = filters?.startDate ? new Date(filters.startDate) : null;
    const endDate = filters?.endDate ? new Date(filters.endDate) : null;

    // Filter transactions for this customer
    const customerInvoices = invoices.filter(inv => inv.customer?._id === customerId);
    const customerPayments = payments.filter(p => {
      if ((p as any).customerId === customerId) return true;
      return ((p as any).customer?._id === customerId);
    });
    const customerTHNs = truckHiringNotes.filter(thn => thn.truckOwnerName === customer.name);

    console.log(`Customer has ${customerInvoices.length} invoices, ${customerPayments.length} payments`);

    // Calculate opening balance from transactions before start date
    const openingBalance = this.calculateOpeningBalance(customerId, customerInvoices, customerPayments, startDate);

    // Generate ledger entries for the period
    const entries: ClientLedgerEntry[] = [];

    // Process invoices in the period (debit entries for receivables)
    customerInvoices.forEach(invoice => {
      const invoiceDate = new Date(invoice.date);
      if (!startDate || invoiceDate >= startDate) {
        if (!endDate || invoiceDate <= endDate) {
          entries.push({
            date: invoice.date,
            voucherNumber: `INV-${invoice.invoiceNumber}`,
            voucherType: 'INVOICE',
            particulars: `Invoice No: INV-${invoice.invoiceNumber} - ${this.getInvoiceDescription(invoice)}`,
            debit: invoice.grandTotal,
            credit: 0,
            balance: 0, // Will be calculated later
            balanceType: 'DR',
            reference: `INV-${invoice.invoiceNumber}`,
            notes: invoice.remarks || undefined
          });
        }
      }
    });

    // Process payments in the period
    customerPayments.forEach(payment => {
      const paymentDate = new Date(payment.date);
      if (!startDate || paymentDate >= startDate) {
        if (!endDate || paymentDate <= endDate) {
          const paymentType = payment.type === PaymentType.ADVANCE ? 'ADVANCE' : 'PAYMENT';
          const particulars = this.getPaymentParticulars(payment, customerInvoices, customerTHNs);

          // For advances, treat as credit to customer (reduces receivable balance)
          // For receipts/payments, also treat as credit but track settlement
          entries.push({
            date: payment.date,
            voucherNumber: payment.referenceNo || `PAY-${payment._id.slice(-6)}`,
            voucherType: paymentType as any,
            particulars,
            debit: 0,
            credit: payment.amount, // All payments reduce customer balance
            balance: 0, // Will be calculated later
            balanceType: 'CR',
            reference: payment.invoiceId ? `INV-${typeof payment.invoiceId === 'string' ? payment.invoiceId : (payment.invoiceId as Invoice).invoiceNumber}` : undefined,
            paymentMode: payment.mode,
            notes: payment.notes || undefined
          });
        }
      }
    });

    // Sort entries by date
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balances starting from opening balance
    let runningBalance = openingBalance.amount * (openingBalance.type === 'DR' ? 1 : -1);
    const processedEntries = entries.map(entry => {
      runningBalance += (entry.debit - entry.credit);
      return {
        ...entry,
        balance: Math.abs(runningBalance),
        balanceType: runningBalance >= 0 ? 'DR' : 'CR' as 'DR' | 'CR'
      };
    });

    // Calculate summary
    const totalDebits = processedEntries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredits = processedEntries.reduce((sum, entry) => sum + entry.credit, 0);
    const closingBalanceAmount = Math.abs(runningBalance);
    const closingBalanceType = runningBalance >= 0 ? 'DR' : 'CR' as 'DR' | 'CR';

    const summary: LedgerSummary = {
      openingBalance: openingBalance.amount,
      openingBalanceType: openingBalance.type,
      totalDebits,
      totalCredits,
      closingBalance: closingBalanceAmount,
      closingBalanceType,
      transactionCount: processedEntries.length
    };

    console.log(`Opening Balance: ${openingBalance.amount} ${openingBalance.type}`);
    console.log(`Period Debits: ${totalDebits}, Credits: ${totalCredits}`);
    console.log(`Closing Balance: ${closingBalanceAmount} ${closingBalanceType}`);

    return {
      customerId,
      customerName: customer.name,
      openingBalance: openingBalance.amount,
      openingBalanceType: openingBalance.type,
      transactions: processedEntries,
      summary
    };
  }

  /**
   * Calculate opening balance for a customer from historical transactions
   */
  private static calculateOpeningBalance(
    customerId: string,
    allInvoices: Invoice[],
    allPayments: Payment[],
    startDate: Date | null
  ): { amount: number; type: 'DR' | 'CR' } {
    if (!startDate) {
      return { amount: 0, type: 'DR' };
    }

    let balance = 0;

    // Add all invoices before start date (increases receivables - DR)
    allInvoices.forEach(invoice => {
      if (new Date(invoice.date) < startDate) {
        balance += invoice.grandTotal;
      }
    });

    // Subtract all payments before start date (reduces receivables - CR)
    allPayments.forEach(payment => {
      if (new Date(payment.date) < startDate) {
        balance -= payment.amount;
      }
    });

    return {
      amount: Math.abs(balance),
      type: balance >= 0 ? 'DR' : 'CR'
    };
  }

  /**
   * Generate company ledger data for all transactions
   */
  static generateCompanyLedger(
    customers: Customer[],
    invoices: Invoice[],
    payments: Payment[],
    truckHiringNotes: TruckHiringNote[],
    filters?: LedgerFilters
  ): CompanyLedgerData {
    const entries: CompanyLedgerEntry[] = [];
    const startDate = filters?.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = filters?.endDate || new Date().toISOString().split('T')[0];

    // Calculate opening balance from all transactions before the period
    const beforeEntries: CompanyLedgerEntry[] = [];

    // Process invoices before period
    invoices.forEach(invoice => {
      if (new Date(invoice.date) < new Date(startDate)) {
        beforeEntries.push(
          {
            date: invoice.date,
            particulars: `Opening - Invoice No: INV-${invoice.invoiceNumber} - Sales`,
            debit: 0,
            credit: invoice.grandTotal,
            balance: 0,
            balanceType: 'CR',
            reference: `INV-${invoice.invoiceNumber}`,
            customerName: invoice.customer?.name,
            notes: invoice.remarks || undefined
          },
          {
            date: invoice.date,
            particulars: `Opening - Invoice No: INV-${invoice.invoiceNumber} - Receivables`,
            debit: invoice.grandTotal,
            credit: 0,
            balance: 0,
            balanceType: 'DR',
            reference: `INV-${invoice.invoiceNumber}`,
            customerName: invoice.customer?.name,
            notes: invoice.remarks || undefined
          }
        );
      }
    });

    // Process payments before period
    payments.forEach(payment => {
      if (new Date(payment.date) < new Date(startDate)) {
        if (payment.type === PaymentType.ADVANCE) {
          beforeEntries.push(
            {
              date: payment.date,
              particulars: `Opening - Advance received from ${payment.customer?.name || 'Unknown Customer'}`,
              debit: 0,
              credit: payment.amount,
              balance: 0,
              balanceType: 'CR',
              reference: payment.referenceNo || payment._id.slice(-6),
              customerName: payment.customer?.name,
              notes: payment.notes || `Payment Mode: ${payment.mode}`
            },
            {
              date: payment.date,
              particulars: `Opening - Cash/Bank (Advance)`,
              debit: payment.amount,
              credit: 0,
              balance: 0,
              balanceType: 'DR',
              reference: payment.referenceNo || payment._id.slice(-6),
              customerName: payment.customer?.name,
              notes: payment.notes || `Payment Mode: ${payment.mode}`
            }
          );
        } else if (payment.type === PaymentType.RECEIPT) {
          const hasTDS = payment.tdsApplicable && payment.tdsAmount && payment.tdsAmount > 0;
          const grossAmount = hasTDS ? (payment.amount + payment.tdsAmount!) : payment.amount;
          const netAmount = payment.amount;

          beforeEntries.push(
            {
              date: payment.date,
              particulars: `Opening - Cash/Bank received`,
              debit: netAmount,
              credit: 0,
              balance: 0,
              balanceType: 'DR',
              reference: payment.referenceNo || payment._id.slice(-6),
              customerName: payment.customer?.name,
              notes: hasTDS ? `${payment.notes || ''} TDS: ₹${payment.tdsAmount}` : payment.notes || `Payment Mode: ${payment.mode}`
            }
          );

          if (hasTDS) {
            beforeEntries.push({
              date: payment.tdsDate || payment.date,
              particulars: `Opening - TDS Payable`,
              debit: 0,
              credit: payment.tdsAmount!,
              balance: 0,
              balanceType: 'CR',
              reference: payment.referenceNo || payment._id.slice(-6),
              customerName: payment.customer?.name,
              notes: `TDS @ ${payment.tdsRate}%`
            });
          }

          beforeEntries.push({
            date: payment.date,
            particulars: `Opening - Accounts Receivable reduction`,
            debit: 0,
            credit: grossAmount,
            balance: 0,
            balanceType: 'CR',
            reference: payment.invoiceId ? `INV-${typeof payment.invoiceId === 'string' ? payment.invoiceId : (payment.invoiceId as Invoice).invoiceNumber}` : undefined,
            customerName: payment.customer?.name,
            notes: payment.notes || `Payment Mode: ${payment.mode}`
          });
        } else if (payment.type === PaymentType.PAYMENT) {
          // Opening balance for payments made
          beforeEntries.push({
            date: payment.date,
            particulars: `Opening - Payment made to ${payment.customer?.name || 'Unknown Vendor'}${payment.truckHiringNoteId ? ` for THN-${typeof payment.truckHiringNoteId === 'string' ? payment.truckHiringNoteId : (payment.truckHiringNoteId as TruckHiringNote).thnNumber}` : ''}`,
            debit: payment.amount,
            credit: 0,
            balance: 0,
            balanceType: 'DR',
            reference: payment.referenceNo || payment._id.slice(-6),
            customerName: payment.customer?.name,
            notes: payment.notes || `Payment Mode: ${payment.mode}`
          });
        }
      }
    });

    // Process THNs before period
    truckHiringNotes.forEach(thn => {
      if (new Date(thn.date) < new Date(startDate)) {
        beforeEntries.push(
          {
            date: thn.date,
            particulars: `Opening - Freight Expense THN-${thn.thnNumber}`,
            debit: thn.freightRate,
            credit: 0,
            balance: 0,
            balanceType: 'DR',
            reference: `THN-${thn.thnNumber}`,
            customerName: thn.truckOwnerName,
            notes: `Route: ${thn.loadingLocation} to ${thn.unloadingLocation}`
          },
          {
            date: thn.date,
            particulars: `Opening - Cash/Bank payment for THN`,
            debit: 0,
            credit: thn.freightRate,
            balance: 0,
            balanceType: 'CR',
            reference: `THN-${thn.thnNumber}`,
            customerName: thn.truckOwnerName,
            notes: `Route: ${thn.loadingLocation} to ${thn.unloadingLocation}`
          }
        );
      }
    });

    // Calculate opening balance
    let openingBalanceAmount = 0;
    beforeEntries.forEach(entry => {
      openingBalanceAmount += (entry.debit - entry.credit);
    });

    // Process invoices (debtors - money expected from customers)
    invoices.forEach(invoice => {
      if (new Date(invoice.date) >= new Date(startDate) && new Date(invoice.date) <= new Date(endDate)) {
        // Pending Payment/Receivable (Debit - money owed to company)
        entries.push({
          date: invoice.date,
          particulars: `Invoice No: INV-${invoice.invoiceNumber} - Pending Payment - ${invoice.customer?.name || 'Unknown Customer'}`,
          debit: invoice.grandTotal,
          credit: 0,
          balance: 0,
          balanceType: 'DR',
          reference: `INV-${invoice.invoiceNumber}`,
          customerName: invoice.customer?.name,
          notes: invoice.remarks || undefined
        });
      }
    });

    // Process payments
    payments.forEach(payment => {
      if (new Date(payment.date) >= new Date(startDate) && new Date(payment.date) <= new Date(endDate)) {
        if (payment.type === PaymentType.ADVANCE) {
          // Advance Received (Credit - reduces positive receivables balance)
          entries.push({
            date: payment.date,
            particulars: `Advance received from ${payment.customer?.name || 'Unknown Customer'} (Ref: ${payment.referenceNo || payment._id.slice(-6)})`,
            debit: 0,
            credit: payment.amount,
            balance: 0,
            balanceType: 'CR',
            reference: payment.referenceNo || payment._id.slice(-6),
            customerName: payment.customer?.name,
            notes: payment.notes || `Payment Mode: ${payment.mode}`
          });
        } else if (payment.type === PaymentType.RECEIPT) {
          // Handle TDS for Receipts
          const hasTDS = payment.tdsApplicable && payment.tdsAmount && payment.tdsAmount > 0;
          const grossAmount = hasTDS ? (payment.amount + payment.tdsAmount!) : payment.amount;

          // Payment Received (Credit - reduces pending receivables)
          entries.push({
            date: payment.date,
            particulars: `Payment received from ${payment.customer?.name || 'Unknown Customer'}${payment.invoiceId ? ` for INV-${typeof payment.invoiceId === 'string' ? payment.invoiceId : (payment.invoiceId as Invoice).invoiceNumber}` : ''}${hasTDS ? ` (Net: ₹${payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}, TDS: ₹${payment.tdsAmount!.toLocaleString('en-IN', { minimumFractionDigits: 2 })})` : ''}`,
            debit: 0,
            credit: grossAmount,
            balance: 0,
            balanceType: 'CR',
            reference: payment.referenceNo || payment._id.slice(-6),
            customerName: payment.customer?.name,
            notes: payment.notes || `Payment Mode: ${payment.mode}`
          });

          // TDS amount if applicable
          if (hasTDS) {
            entries.push({
              date: payment.tdsDate || payment.date,
              particulars: `TDS payable @ ${payment.tdsRate}%`,
              debit: payment.tdsAmount!,
              credit: 0,
              balance: 0,
              balanceType: 'DR',
              reference: payment.referenceNo || payment._id.slice(-6),
              customerName: payment.customer?.name,
              notes: `TDS deducted from payment received`
            });
          }
        } else if (payment.type === PaymentType.PAYMENT) {
          // Payment Made (Debit - money going out, e.g., to truck owners)
          entries.push({
            date: payment.date,
            particulars: `Payment made to ${payment.customer?.name || 'Unknown Vendor'}${payment.truckHiringNoteId ? ` for THN-${typeof payment.truckHiringNoteId === 'string' ? payment.truckHiringNoteId : (payment.truckHiringNoteId as TruckHiringNote).thnNumber}` : ''} (Ref: ${payment.referenceNo || payment._id.slice(-6)})`,
            debit: payment.amount,
            credit: 0,
            balance: 0,
            balanceType: 'DR',
            reference: payment.referenceNo || payment._id.slice(-6),
            customerName: payment.customer?.name,
            notes: payment.notes || `Payment Mode: ${payment.mode}`
          });
        }
      }
    });

    // Process THNs (expenses)
    truckHiringNotes.forEach(thn => {
      if (new Date(thn.date) >= new Date(startDate) && new Date(thn.date) <= new Date(endDate)) {
        // Freight Expense (Credit - money paid out, reduces profit balance)
        entries.push({
          date: thn.date,
          particulars: `Freight expense for THN-${thn.thnNumber} - ${thn.truckOwnerName}`,
          debit: 0,
          credit: thn.freightRate,
          balance: 0,
          balanceType: 'CR',
          reference: `THN-${thn.thnNumber}`,
          customerName: thn.truckOwnerName,
          notes: `Route: ${thn.loadingLocation} to ${thn.unloadingLocation}`
        });
      }
    });

    // Sort entries by date
    entries.sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Calculate running balances starting from opening balance
    let runningBalance = openingBalanceAmount;
    const processedEntries = entries.map(entry => {
      runningBalance += (entry.debit - entry.credit);

      return {
        ...entry,
        balance: Math.abs(runningBalance),
        balanceType: (runningBalance >= 0 ? 'DR' : 'CR') as 'DR' | 'CR'
      };
    });

    // Calculate summary
    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const totalExpenses = truckHiringNotes.reduce((sum, thn) => sum + thn.freightRate, 0);
    const netProfit = totalRevenue - totalExpenses;

    // Final balances
    const openingBalance = Math.abs(openingBalanceAmount);
    const openingBalanceType = openingBalanceAmount >= 0 ? 'DR' : 'CR' as 'DR' | 'CR';
    const closingBalance = Math.abs(runningBalance);
    const closingBalanceType = runningBalance >= 0 ? 'DR' : 'CR' as 'DR' | 'CR';

    return {
      period: { startDate, endDate },
      transactions: processedEntries,
      openingBalance: Math.abs(openingBalance),
      openingBalanceType,
      closingBalance: Math.abs(closingBalance),
      closingBalanceType,
      summary: {
        totalRevenue,
        totalExpenses,
        netProfit,
        totalAssets: 0, // Would need asset calculations
        totalLiabilities: 0, // Would need liability calculations
        openingBalance: Math.abs(openingBalance),
        openingBalanceType,
        closingBalance: Math.abs(closingBalance),
        closingBalanceType
      }
    };
  }

  /**
   * Get descriptive text for invoice
   */
  private static getInvoiceDescription(invoice: Invoice): string {
    const lrCount = invoice.lorryReceipts?.length || 0;
    const customerName = invoice.customer?.name || 'Unknown Customer';
    return `Freight charges for ${lrCount} LR${lrCount > 1 ? 's' : ''} - ${customerName}`;
  }

  /**
   * Get descriptive text for payment particulars
   */
  private static getPaymentParticulars(
    payment: Payment, 
    customerInvoices: Invoice[], 
    customerTHNs: TruckHiringNote[]
  ): string {
    const customerName = payment.customer?.name || 'Unknown Customer';
    const paymentMode = payment.mode;
    
    if (payment.type === PaymentType.ADVANCE) {
      return `Advance received from ${customerName} (Ref: ${payment.referenceNo || 'ADVANCE'}) - Mode: ${paymentMode}`;
    }
    
    if (payment.invoiceId) {
      const invoiceNumber = typeof payment.invoiceId === 'string' 
        ? payment.invoiceId 
        : (payment.invoiceId as Invoice).invoiceNumber;
      return `Payment for Invoice INV-${invoiceNumber} - ${customerName} (Mode: ${paymentMode})`;
    }
    
    if (payment.truckHiringNoteId) {
      const thnNumber = typeof payment.truckHiringNoteId === 'string' 
        ? payment.truckHiringNoteId 
        : (payment.truckHiringNoteId as TruckHiringNote).thnNumber;
      return `Payment for THN-${thnNumber} - ${customerName} (Mode: ${paymentMode})`;
    }
    
    return `Payment received from ${customerName} (Mode: ${paymentMode})`;
  }

  /**
   * Format currency for display
   */
  static formatCurrency(amount: number): string {
    return `₹${amount.toFixed(2)}`;
  }

  /**
   * Format date for display
   */
  static formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
}
