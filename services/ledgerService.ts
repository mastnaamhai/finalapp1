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
    const customerTHNs = truckHiringNotes.filter(thn => thn.agencyName === customer.name);

    console.log(`Customer has ${customerInvoices.length} invoices, ${customerPayments.length} payments, ${customerTHNs.length} THNs`);

    // Calculate opening balance from transactions before start date
    const openingBalance = this.calculateOpeningBalance(customerId, customerInvoices, customerPayments, startDate, customerTHNs);

    // Generate ledger entries for the period
    const entries: ClientLedgerEntry[] = [];

    // Process THNs for this broker/client (CREDIT to broker, they performed a service)
    customerTHNs.forEach(thn => {
      const thnDate = new Date(thn.date);
      if (!startDate || thnDate >= startDate) {
        if (!endDate || thnDate <= endDate) {
          entries.push({
            date: thn.date,
            voucherNumber: `THN-${thn.thnNumber}`,
            voucherType: 'PAYMENT' as any, // Treat as a liability record
            particulars: `Truck Hire: THN-${thn.thnNumber} - ${thn.loadingLocation} to ${thn.unloadingLocation}`,
            debit: 0,
            credit: thn.freightRate + (thn.additionalCharges || 0),
            balance: 0,
            balanceType: 'CR',
            reference: `THN-${thn.thnNumber}`,
            notes: thn.remarks || undefined
          });
        }
      }
    });

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
          const particulars = this.getPaymentParticulars(payment, customerInvoices, customerTHNs);

          // Determine if it's a payment from client (Credit) or to broker (Debit)
          // Money IN (Advance for Invoice) = Credit to Client
          // Money OUT (Payment/Advance for THN) = Debit to Broker
          const isMoneyOut = !!payment.truckHiringNoteId;
          const isMoneyIn = !!payment.invoiceId || (!payment.truckHiringNoteId && (payment.type === PaymentType.ADVANCE || (payment.type as any) === 'Receipt'));

          entries.push({
            date: payment.date,
            voucherNumber: payment.referenceNo || `PAY-${payment._id.slice(-6)}`,
            voucherType: payment.type as any,
            particulars,
            debit: isMoneyOut ? payment.amount : 0,
            credit: isMoneyIn ? payment.amount : 0,
            balance: 0, // Will be calculated later
            balanceType: isMoneyIn ? 'CR' : 'DR',
            reference: payment.invoiceId ? `INV-${typeof payment.invoiceId === 'string' ? payment.invoiceId : (payment.invoiceId as Invoice).invoiceNumber}` :
                      payment.truckHiringNoteId ? `THN-${typeof payment.truckHiringNoteId === 'string' ? payment.truckHiringNoteId : (payment.truckHiringNoteId as TruckHiringNote).thnNumber}` : undefined,
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
    startDate: Date | null,
    allTHNs: TruckHiringNote[] = []
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

    // Handle payments before start date
    allPayments.forEach(payment => {
      if (new Date(payment.date) < startDate) {
        const isMoneyOut = !!payment.truckHiringNoteId;
        const isMoneyIn = !!payment.invoiceId || (!payment.truckHiringNoteId && (payment.type === PaymentType.ADVANCE || (payment.type as any) === 'Receipt'));

        if (isMoneyIn) balance -= payment.amount;
        if (isMoneyOut) balance += payment.amount;
      }
    });

    // Handle THNs before start date (reduces receivables/increases payables - CR)
    allTHNs.forEach(thn => {
      if (new Date(thn.date) < startDate) {
        balance -= (thn.freightRate + (thn.additionalCharges || 0));
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

    // 1. Calculate Opening Balance from all transactions BEFORE startDate
    let openingBalanceAmount = 0;

    invoices.forEach(inv => {
      if (new Date(inv.date) < new Date(startDate)) openingBalanceAmount += inv.grandTotal;
    });

    truckHiringNotes.forEach(thn => {
      if (new Date(thn.date) < new Date(startDate)) openingBalanceAmount -= (thn.freightRate + (thn.additionalCharges || 0));
    });

    payments.forEach(p => {
      if (new Date(p.date) < new Date(startDate)) {
        const isMoneyOut = !!p.truckHiringNoteId;
        const isMoneyIn = !!p.invoiceId || (!p.truckHiringNoteId && (p.type === PaymentType.ADVANCE || (p.type as any) === 'Receipt'));
        if (isMoneyIn) openingBalanceAmount -= p.amount;
        if (isMoneyOut) openingBalanceAmount += p.amount;

        if (p.tdsAmount) openingBalanceAmount -= p.tdsAmount;
      }
    });

    // 2. Process transactions within the period
    invoices.forEach(invoice => {
      const invoiceDate = new Date(invoice.date);
      if (invoiceDate >= new Date(startDate) && invoiceDate <= new Date(endDate)) {
        entries.push({
          date: invoice.date,
          particulars: `Invoice: INV-${invoice.invoiceNumber} - ${invoice.customer?.name || 'Unknown Customer'}`,
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

    truckHiringNotes.forEach(thn => {
      const thnDate = new Date(thn.date);
      if (thnDate >= new Date(startDate) && thnDate <= new Date(endDate)) {
        entries.push({
          date: thn.date,
          particulars: `Truck Hire: THN-${thn.thnNumber} - ${thn.agencyName} (${thn.loadingLocation} to ${thn.unloadingLocation})`,
          debit: 0,
          credit: thn.freightRate + (thn.additionalCharges || 0),
          balance: 0,
          balanceType: 'CR',
          reference: `THN-${thn.thnNumber}`,
          customerName: thn.agencyName,
          notes: thn.remarks || undefined
        });
      }
    });

    payments.forEach(payment => {
      const paymentDate = new Date(payment.date);
      if (paymentDate >= new Date(startDate) && paymentDate <= new Date(endDate)) {
        const isMoneyOut = !!payment.truckHiringNoteId;
        const isMoneyIn = !!payment.invoiceId || (!payment.truckHiringNoteId && (payment.type === PaymentType.ADVANCE || (payment.type as any) === 'Receipt'));

        entries.push({
          date: payment.date,
          particulars: `${payment.type} ${isMoneyIn ? 'from' : 'to'} ${payment.customer?.name || (payment as any).agencyName || 'Broker/Client'} (Ref: ${payment.referenceNo || 'N/A'})`,
          debit: isMoneyOut ? payment.amount : 0,
          credit: isMoneyIn ? payment.amount : 0,
          balance: 0,
          balanceType: isMoneyIn ? 'CR' : 'DR',
          reference: payment.referenceNo,
          customerName: payment.customer?.name,
          notes: payment.notes || `Mode: ${payment.mode}`
        });

        if (payment.tdsAmount && payment.tdsAmount > 0) {
           entries.push({
            date: payment.tdsDate || payment.date,
            particulars: `TDS Deducted for ${payment.referenceNo || 'Payment'}`,
            debit: 0,
            credit: payment.tdsAmount,
            balance: 0,
            balanceType: 'CR',
            reference: payment.referenceNo,
            customerName: payment.customer?.name,
            notes: `TDS @ ${payment.tdsRate}%`
          });
        }
      }
    });

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 3. Calculate running balances starting from openingBalanceAmount
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
    const totalRevenue = invoices.reduce((sum, inv) => {
        const d = new Date(inv.date);
        if (d >= new Date(startDate) && d <= new Date(endDate)) return sum + inv.grandTotal;
        return sum;
    }, 0);
    const totalExpenses = truckHiringNotes.reduce((sum, thn) => {
        const d = new Date(thn.date);
        if (d >= new Date(startDate) && d <= new Date(endDate)) return sum + (thn.freightRate + (thn.additionalCharges || 0));
        return sum;
    }, 0);
    const netProfit = totalRevenue - totalExpenses;

    const closingBalance = Math.abs(runningBalance);
    const closingBalanceType = runningBalance >= 0 ? 'DR' : 'CR' as 'DR' | 'CR';

    const openingBalance = Math.abs(openingBalanceAmount);
    const openingBalanceType = openingBalanceAmount >= 0 ? 'DR' : 'CR' as 'DR' | 'CR';

    return {
      period: { startDate, endDate },
      transactions: processedEntries,
      openingBalance,
      openingBalanceType,
      closingBalance,
      closingBalanceType,
      summary: {
        totalRevenue,
        totalExpenses,
        netProfit,
        totalAssets: 0,
        totalLiabilities: 0,
        openingBalance,
        openingBalanceType,
        closingBalance,
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
