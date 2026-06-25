import type {
  Customer,
  Invoice,
  Payment,
  TruckHiringNote
} from '../types';
import { PaymentType } from '../types';
import type {
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
    const startDate = filters?.startDate ? new Date(filters.startDate) : null;
    const endDate = filters?.endDate ? new Date(filters.endDate) : null;

    // Filter transactions for this customer
    const customerInvoices = invoices.filter(inv => inv.customer?._id === customerId);
    const customerPayments = payments.filter(p => {
      const pCustomerId = (p as any).customerId || (typeof p.customer === 'string' ? p.customer : p.customer?._id);
      return pCustomerId === customerId;
    });
    const customerTHNs = truckHiringNotes.filter(thn => thn.agencyName === customer.name);

    // Calculate opening balance from transactions before start date
    const openingBalance = this.calculateOpeningBalance(customerId, customerInvoices, customerPayments, startDate, customerTHNs);

    // Generate ledger entries for the period
    const entries: ClientLedgerEntry[] = [];

    // Process THNs for this broker/client (CREDIT to broker, they performed a service)
    customerTHNs.forEach(thn => {
      const thnDate = new Date(thn.date);
      if (!startDate || thnDate >= startDate) {
        if (!endDate || thnDate <= endDate) {
          const totalAmount = thn.freightRate + (thn.additionalCharges || 0);
          entries.push({
            date: thn.date,
            voucherNumber: `THN-${thn.thnNumber}`,
            voucherType: 'FREIGHT' as any,
            particulars: `Freight Charges Payable - ${thn.agencyName} (THN-${thn.thnNumber})`,
            debit: 0,
            credit: totalAmount,
            balance: 0,
            balanceType: 'CR',
            reference: `THN-${thn.thnNumber}`,
            notes: `From: ${thn.loadingLocation} to ${thn.unloadingLocation}${thn.remarks ? ` | ${thn.remarks}` : ''}`
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
      const isMoneyOut = !!payment.truckHiringNoteId;
      const isMoneyIn = !!payment.invoiceId ||
        (payment.settlements && payment.settlements.length > 0) ||
        (!payment.truckHiringNoteId && (
          payment.type === PaymentType.ADVANCE ||
          payment.type === PaymentType.PAYMENT ||
          (payment.type as any) === 'Receipt'
        ));

      const paymentDate = new Date(payment.date);
      if (!startDate || paymentDate >= startDate) {
        if (!endDate || paymentDate <= endDate) {
          const particulars = this.getPaymentParticulars(payment, customerInvoices, customerTHNs);

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

      // Process TDS independently for correct period reporting
      if (isMoneyIn && payment.tdsAmount && payment.tdsAmount > 0) {
        const tdsDateVal = payment.tdsDate || payment.date;
        const tdsDateObj = new Date(tdsDateVal);
        if (!startDate || tdsDateObj >= startDate) {
          if (!endDate || tdsDateObj <= endDate) {
            entries.push({
              date: tdsDateVal,
              voucherNumber: `TDS-${payment._id.slice(-6)}`,
              voucherType: 'Receipt' as any,
              particulars: this.getTDSParticulars(payment, customerInvoices),
              debit: 0,
              credit: payment.tdsAmount,
              balance: 0,
              balanceType: 'CR',
              reference: payment.referenceNo,
              paymentMode: 'TDS',
              notes: `TDS @ ${payment.tdsRate || 0}%`
            });
          }
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

    return {
      customerId,
      customerName: customer.name,
      openingBalance: openingBalance.amount,
      openingBalanceType: openingBalance.type,
      transactions: processedEntries,
      summary
    };
  }

  private static calculateOpeningBalance(
    _customerId: string,
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
      const isMoneyOut = !!payment.truckHiringNoteId;
      const isMoneyIn = !!payment.invoiceId ||
        (payment.settlements && payment.settlements.length > 0) ||
        (!payment.truckHiringNoteId && (
          payment.type === PaymentType.ADVANCE ||
          payment.type === PaymentType.PAYMENT ||
          (payment.type as any) === 'Receipt'
        ));

      if (new Date(payment.date) < startDate) {
        if (isMoneyIn) balance -= payment.amount;
        if (isMoneyOut) balance += payment.amount;
      }

      // Handle TDS independently for opening balance
      if (isMoneyIn && payment.tdsAmount) {
        const tdsDate = payment.tdsDate ? new Date(payment.tdsDate) : new Date(payment.date);
        if (tdsDate < startDate) {
          balance -= payment.tdsAmount;
        }
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
      const isMoneyOut = !!p.truckHiringNoteId;
      const isMoneyIn = !!p.invoiceId ||
        (p.settlements && p.settlements.length > 0) ||
        (!p.truckHiringNoteId && (
          p.type === PaymentType.ADVANCE ||
          p.type === PaymentType.PAYMENT ||
          (p.type as any) === 'Receipt'
        ));

      if (new Date(p.date) < new Date(startDate)) {
        if (isMoneyIn) openingBalanceAmount -= p.amount;
        if (isMoneyOut) openingBalanceAmount += p.amount;
      }

      if (isMoneyIn && p.tdsAmount) {
        const tdsDate = p.tdsDate ? new Date(p.tdsDate) : new Date(p.date);
        if (tdsDate < new Date(startDate)) {
          openingBalanceAmount -= p.tdsAmount;
        }
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
        const totalAmount = thn.freightRate + (thn.additionalCharges || 0);
        entries.push({
          date: thn.date,
          particulars: `Freight Charges Payable - ${thn.agencyName} (THN-${thn.thnNumber})`,
          debit: 0,
          credit: totalAmount,
          balance: 0,
          balanceType: 'CR',
          reference: `THN-${thn.thnNumber}`,
          customerName: thn.agencyName,
          notes: `From: ${thn.loadingLocation} to ${thn.unloadingLocation} | Truck: ${thn.truckNumber}${thn.remarks ? ` | ${thn.remarks}` : ''}`
        });
      }
    });

    payments.forEach(payment => {
      const isMoneyOut = !!payment.truckHiringNoteId;
      const isMoneyIn = !!payment.invoiceId ||
        (payment.settlements && payment.settlements.length > 0) ||
        (!payment.truckHiringNoteId && (
          payment.type === PaymentType.ADVANCE ||
          payment.type === PaymentType.PAYMENT ||
          (payment.type as any) === 'Receipt'
        ));

      const paymentDate = new Date(payment.date);
      if (paymentDate >= new Date(startDate) && paymentDate <= new Date(endDate)) {
        // Resolve customer name from customers list if needed
        let resolvedCustomerName = payment.customer?.name || (payment as any).agencyName;
        if (!resolvedCustomerName && payment.customer) {
          const custId = typeof payment.customer === 'string' ? payment.customer : (payment.customer as any)._id;
          const found = customers.find(c => c._id === custId);
          if (found) resolvedCustomerName = found.name;
        }

        const custName = resolvedCustomerName || 'Broker/Client';

        // Build particulars with invoice references if available
        let particulars = `${payment.type} ${isMoneyIn ? 'from' : 'to'} ${custName}`;
        if (payment.invoiceId) {
          const invId = typeof payment.invoiceId === 'string' ? payment.invoiceId : (payment.invoiceId as any)._id;
          const inv = invoices.find(i => i._id === invId);
          if (inv) particulars += ` (Inv: #${inv.invoiceNumber})`;
        } else if (payment.settlements && payment.settlements.length > 0) {
          const invNumbers = payment.settlements
            .map(s => {
              const invId = typeof s.invoiceId === 'string' ? s.invoiceId : (s.invoiceId as any)._id;
              const inv = invoices.find(i => i._id === invId);
              return inv ? `#${inv.invoiceNumber}` : '';
            })
            .filter(n => n)
            .join(', ');
          if (invNumbers) particulars += ` (Invs: ${invNumbers})`;
        }

        if (payment.referenceNo) particulars += ` | Ref: ${payment.referenceNo}`;

        entries.push({
          date: payment.date,
          particulars,
          debit: isMoneyOut ? payment.amount : 0,
          credit: isMoneyIn ? payment.amount : 0,
          balance: 0,
          balanceType: isMoneyIn ? 'CR' : 'DR',
          reference: payment.referenceNo,
          customerName: resolvedCustomerName,
          notes: payment.notes || `Mode: ${payment.mode}`
        });
      }

      if (isMoneyIn && payment.tdsAmount && payment.tdsAmount > 0) {
        const tdsDateVal = payment.tdsDate || payment.date;
        const tdsDateObj = new Date(tdsDateVal);
        if (tdsDateObj >= new Date(startDate) && tdsDateObj <= new Date(endDate)) {
          entries.push({
            date: tdsDateVal,
            particulars: this.getTDSParticulars(payment, invoices),
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
    const customerName = payment.customer?.name || (payment as any).agencyName || 'Broker/Client';
    const paymentMode = payment.mode || 'N/A';

    // Handle single invoice link (legacy or direct)
    if (payment.invoiceId) {
      const invoice = customerInvoices.find(inv => inv._id === payment.invoiceId);
      if (invoice) {
        return `Payment Received: Invoice #${invoice.invoiceNumber} - ${customerName}`;
      }
    }

    // Handle allocations (settlements)
    if (payment.settlements && payment.settlements.length > 0) {
      const invoiceNumbers = payment.settlements
        .map(s => {
          // settlements might have populated invoice or just ID
          // Need to find invoice number from the invoice list passed to this function
          const invId = typeof s.invoiceId === 'string' ? s.invoiceId : (s.invoiceId as any)._id;
          const inv = customerInvoices.find(i => i._id === invId);
          return inv ? `#${inv.invoiceNumber}` : '';
        })
        .filter(Boolean)
        .join(', ');

      if (invoiceNumbers) {
        return `Payment Received (${payment.type === 'Advance' ? 'Allocated' : 'Bulk'}): Invoices ${invoiceNumbers} - ${customerName}`;
      }
    }

    if (payment.truckHiringNoteId) {
      const thn = customerTHNs.find(t => t._id === payment.truckHiringNoteId);
      if (thn) {
        return `Freight Payment: ${customerName} (THN-${thn.thnNumber})`;
      }
      return `Freight Payment: ${customerName}`;
    }

    if (payment.type === PaymentType.ADVANCE) {
      return `Advance Received: ${customerName} (${paymentMode})`;
    }

    return `Payment ${payment.amount >= 0 ? 'from' : 'to'} ${customerName} (${paymentMode})`;
  }

  /**
   * Get descriptive text for TDS particulars
   */
  private static getTDSParticulars(payment: Payment, invoices: Invoice[]): string {
    const ref = payment.referenceNo ? ` (Ref: ${payment.referenceNo})` : '';
    let invoiceContext = '';

    // Check for direct invoice link
    if (payment.invoiceId) {
      const invId = typeof payment.invoiceId === 'string' ? payment.invoiceId : (payment.invoiceId as any)._id;
      const inv = invoices.find(i => i._id === invId);
      if (inv) {
        invoiceContext = ` - Invoice #${inv.invoiceNumber}`;
      }
    }
    // Check for settlements
    else if (payment.settlements && payment.settlements.length > 0) {
      const invoiceNumbers = payment.settlements
        .map(s => {
          const invId = typeof s.invoiceId === 'string' ? s.invoiceId : (s.invoiceId as any)._id;
          const inv = invoices.find(i => i._id === invId);
          return inv ? `#${inv.invoiceNumber}` : '';
        })
        .filter(Boolean)
        .join(', ');

      if (invoiceNumbers) {
        invoiceContext = ` - Invoices ${invoiceNumbers}`;
      }
    }

    return `TDS Deducted${ref}${invoiceContext}`;
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
