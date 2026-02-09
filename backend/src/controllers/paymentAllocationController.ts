import { Request, Response } from 'express';
import { PaymentAllocationService } from '../services/paymentAllocationService';

/**
 * Payment Allocation Controller
 * Handles HTTP requests for payment allocation operations
 */
export class PaymentAllocationController {

    /**
     * POST /api/payments/advance
     * Record an advance payment
     */
    static async recordAdvancePayment(req: Request, res: Response) {
        try {
            const payment = await PaymentAllocationService.recordAdvancePayment(req.body);
            res.status(201).json(payment);
        } catch (error: any) {
            console.error('Error recording advance payment:', error);
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * POST /api/payments/:id/allocate
     * Allocate an existing payment to invoices
     */
    static async allocatePaymentToInvoices(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const payment = await PaymentAllocationService.allocatePaymentToInvoices({
                paymentId: id,
                allocations: req.body.allocations
            });
            res.status(200).json(payment);
        } catch (error: any) {
            console.error('Error allocating payment:', error);
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * POST /api/payments/bulk
     * Record a bulk payment with allocations
     */
    static async recordBulkPayment(req: Request, res: Response) {
        try {
            const payment = await PaymentAllocationService.recordBulkPayment(req.body);
            res.status(201).json(payment);
        } catch (error: any) {
            console.error('Error recording bulk payment:', error);
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * GET /api/customers/:id/account-summary
     * Get customer account summary
     */
    static async getCustomerAccountSummary(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const summary = await PaymentAllocationService.getCustomerAccountSummary(id);
            res.status(200).json(summary);
        } catch (error: any) {
            console.error('Error fetching customer account summary:', error);
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * GET /api/customers/:id/unallocated-payments
     * Get unallocated payments for a customer
     */
    static async getUnallocatedPayments(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const payments = await PaymentAllocationService.getUnallocatedPayments(id);
            res.status(200).json(payments);
        } catch (error: any) {
            console.error('Error fetching unallocated payments:', error);
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * POST /api/payments/:id/reverse-allocation
     * Reverse a payment allocation
     */
    static async reverseAllocation(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const result = await PaymentAllocationService.reverseAllocation({
                paymentId: id,
                invoiceId: req.body.invoiceId
            });
            res.status(200).json(result);
        } catch (error: any) {
            console.error('Error reversing allocation:', error);
            res.status(400).json({ error: error.message });
        }
    }
}
