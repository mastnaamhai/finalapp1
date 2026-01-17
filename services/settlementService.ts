import type { Invoice, Payment } from '../types';
import { PaymentType, InvoiceStatus } from '../types';

export class SettlementService {
  /**
   * Allocate payment amounts to outstanding invoices for a customer
   */
  static allocatePaymentToInvoices(
    payment: Payment,
    outstandingInvoices: Invoice[]
  ): {
    settlements: { invoiceId: string; amount: number }[];
    remainingAmount: number;
  } {
    const settlements: { invoiceId: string; amount: number }[] = [];
    let remainingAmount = payment.amount;

    // Sort invoices by date (oldest first)
    const sortedInvoices = [...outstandingInvoices].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const invoice of sortedInvoices) {
      if (remainingAmount <= 0) break;

      const outstandingAmount = this.getOutstandingAmount(invoice);
      if (outstandingAmount > 0) {
        const allocationAmount = Math.min(remainingAmount, outstandingAmount);
        settlements.push({
          invoiceId: invoice._id,
          amount: allocationAmount
        });
        remainingAmount -= allocationAmount;
      }
    }

    return { settlements, remainingAmount };
  }

  /**
   * Get the outstanding amount for an invoice
   */
  static getOutstandingAmount(invoice: Invoice): number {
    const settledAmount = invoice.settledAmount || 0;
    return invoice.grandTotal - settledAmount;
  }

  /**
   * Check if an invoice is fully settled
   */
  static isInvoiceSettled(invoice: Invoice): boolean {
    return this.getOutstandingAmount(invoice) <= 0;
  }

  /**
   * Get settlement status for an invoice
   */
  static getInvoiceSettlementStatus(invoice: Invoice): InvoiceStatus {
    const outstandingAmount = this.getOutstandingAmount(invoice);

    if (outstandingAmount <= 0) {
      return InvoiceStatus.PAID;
    } else if ((invoice.settledAmount || 0) > 0) {
      return InvoiceStatus.PARTIALLY_PAID;
    } else {
      return InvoiceStatus.UNPAID;
    }
  }

  /**
   * Calculate total outstanding amount for a customer across all invoices
   */
  static getTotalOutstandingForCustomer(invoices: Invoice[]): number {
    return invoices.reduce((total, invoice) => {
      return total + Math.max(0, this.getOutstandingAmount(invoice));
    }, 0);
  }

  /**
   * Get available advance amount for a customer
   */
  static getAvailableAdvances(payments: Payment[]): number {
    return payments
      .filter(p => p.type === PaymentType.ADVANCE)
      .reduce((total, payment) => {
        const settledAmount = payment.settlements?.reduce((sum, s) => sum + s.amount, 0) || 0;
        return total + (payment.amount - settledAmount);
      }, 0);
  }

  /**
   * Apply advances to outstanding invoices
   */
  static applyAdvancesToInvoices(
    advances: Payment[],
    outstandingInvoices: Invoice[]
  ): {
    advanceApplications: { advanceId: string; invoiceId: string; amount: number }[];
    remainingAdvances: Payment[];
  } {
    const advanceApplications: { advanceId: string; invoiceId: string; amount: number }[] = [];
    const remainingAdvances: Payment[] = [];

    // Sort advances by date (oldest first)
    const sortedAdvances = [...advances].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const advance of sortedAdvances) {
      const availableAdvanceAmount = advance.amount - (advance.settlements?.reduce((sum, s) => sum + s.amount, 0) || 0);

      if (availableAdvanceAmount <= 0) continue;

      // Apply this advance to outstanding invoices
      const { settlements, remainingAmount } = this.allocatePaymentToInvoices(
        { ...advance, amount: availableAdvanceAmount },
        outstandingInvoices
      );

      // Record the applications
      settlements.forEach(settlement => {
        advanceApplications.push({
          advanceId: advance._id,
          invoiceId: settlement.invoiceId,
          amount: settlement.amount
        });
      });

      // If there's remaining advance amount, keep it for later
      if (remainingAmount > 0) {
        remainingAdvances.push({
          ...advance,
          amount: remainingAmount
        });
      }
    }

    return { advanceApplications, remainingAdvances };
  }

  /**
   * Recalculate all settlements for a customer
   * This should be called when fixing corrupted data
   */
  static recalculateSettlements(
    payments: Payment[],
    invoices: Invoice[]
  ): {
    updatedPayments: Payment[];
    updatedInvoices: Invoice[];
  } {
    // Reset all settlements
    const resetPayments = payments.map(p => ({
      ...p,
      settlements: [],
      unsettledAmount: p.amount
    }));

    const resetInvoices = invoices.map(inv => ({
      ...inv,
      settlements: [],
      settledAmount: 0,
      outstandingAmount: inv.grandTotal
    }));

    // Re-apply all payments in chronological order
    const sortedPayments = [...resetPayments].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const payment of sortedPayments) {
      if (payment.type === PaymentType.ADVANCE) {
        // Advances are kept separate until applied
        continue;
      }

      // Allocate payment to outstanding invoices
      const outstandingInvoices = resetInvoices.filter(inv =>
        this.getOutstandingAmount(inv) > 0
      );

      const { settlements } = this.allocatePaymentToInvoices(payment, outstandingInvoices);

      // Apply settlements
      settlements.forEach(settlement => {
        const invoice = resetInvoices.find(inv => inv._id === settlement.invoiceId);
        if (invoice) {
          invoice.settlements = invoice.settlements || [];
          invoice.settlements.push({
            paymentId: payment._id,
            amount: settlement.amount,
            date: payment.date
          });
          invoice.settledAmount = (invoice.settledAmount || 0) + settlement.amount;
          invoice.outstandingAmount = invoice.grandTotal - invoice.settledAmount;
        }

        payment.settlements = payment.settlements || [];
        payment.settlements.push({
          invoiceId: settlement.invoiceId,
          amount: settlement.amount,
          date: payment.date
        });
      });

      payment.unsettledAmount = payment.amount - (payment.settlements?.reduce((sum, s) => sum + s.amount, 0) || 0);
    }

    // Apply advances to remaining outstanding invoices
    const advances = sortedPayments.filter(p => p.type === PaymentType.ADVANCE);
    const remainingOutstandingInvoices = resetInvoices.filter(inv =>
      this.getOutstandingAmount(inv) > 0
    );

    const { advanceApplications } = this.applyAdvancesToInvoices(advances, remainingOutstandingInvoices);

    // Apply advance settlements
    advanceApplications.forEach(application => {
      const advance = resetPayments.find(p => p._id === application.advanceId);
      const invoice = resetInvoices.find(inv => inv._id === application.invoiceId);

      if (advance && invoice) {
        advance.settlements = advance.settlements || [];
        advance.settlements.push({
          invoiceId: application.invoiceId,
          amount: application.amount,
          date: advance.date
        });

        invoice.settlements = invoice.settlements || [];
        invoice.settlements.push({
          paymentId: application.advanceId,
          amount: application.amount,
          date: advance.date
        });

        invoice.settledAmount = (invoice.settledAmount || 0) + application.amount;
        invoice.outstandingAmount = invoice.grandTotal - invoice.settledAmount;
      }
    });

    return {
      updatedPayments: resetPayments,
      updatedInvoices: resetInvoices
    };
  }
}
