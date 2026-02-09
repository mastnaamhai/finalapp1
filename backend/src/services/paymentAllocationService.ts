import mongoose from 'mongoose';
import Payment from '../models/payment';
import Invoice from '../models/invoice';
import Customer from '../models/customer';
import Numbering from '../models/numbering';
import { PaymentType, PaymentMode, InvoiceStatus } from '../types';

/**
 * Payment Allocation Service
 * Handles advance payments, multi-invoice settlements, and customer account management
 */
export class PaymentAllocationService {

    /**
     * Record an advance payment (payment without invoice link)
     */
    static async recordAdvancePayment(data: {
        customerId: string;
        amount: number;
        date: string;
        mode: PaymentMode;
        referenceNo?: string;
        notes?: string;
        // TDS fields
        tdsAmount?: number;
        tdsDate?: string;
    }) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Get next payment number
            let numbering = await Numbering.findOne({ type: 'payment' });
            if (!numbering) {
                // Initialize if not found
                numbering = new Numbering({
                    type: 'payment',
                    startingNumber: 1,
                    currentNumber: 1,
                    prefix: 'PAY'
                });
            }
            const paymentNumber = numbering.currentNumber;
            numbering.currentNumber += 1;
            await numbering.save({ session });

            const grossAmount = data.amount + (data.tdsAmount || 0);

            // Create payment record
            const payment = new Payment({
                paymentNumber,
                customer: data.customerId,
                date: data.date,
                amount: data.amount,
                type: PaymentType.ADVANCE,
                mode: data.mode,
                referenceNo: data.referenceNo,
                notes: data.notes,
                // TDS fields
                tdsApplicable: !!data.tdsAmount,
                tdsAmount: data.tdsAmount || 0,
                tdsDate: data.tdsDate || data.date,
                // Allocation tracking fields
                allocationType: 'advance',
                isAdvancePayment: true,
                allocatedAmount: 0,
                unallocatedAmount: grossAmount,
                status: 'unallocated',
                settlements: []
            });
            await payment.save({ session });

            // Update customer's advance payments balance
            await Customer.findByIdAndUpdate(
                data.customerId,
                {
                    $inc: {
                        advancePayments: data.amount + (data.tdsAmount || 0),
                        creditBalance: -(data.amount + (data.tdsAmount || 0)) // Negative because customer paid us in advance
                    },
                    lastPaymentDate: data.date
                },
                { session }
            );

            await session.commitTransaction();

            return await Payment.findById(payment._id).populate('customer');
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Allocate an existing payment to one or more invoices
     */
    static async allocatePaymentToInvoices(data: {
        paymentId: string;
        allocations: {
            invoiceId: string;
            amount: number;
        }[];
    }) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Get payment
            const payment = await Payment.findById(data.paymentId).session(session);
            if (!payment) {
                throw new Error('Payment not found');
            }

            // Calculate total allocation amount
            const totalAllocation = data.allocations.reduce((sum, a) => sum + a.amount, 0);

            // Validate: Cannot allocate more than unallocated amount
            if (totalAllocation > (payment.unallocatedAmount || 0)) {
                throw new Error(
                    `Cannot allocate ₹${totalAllocation}. Only ₹${payment.unallocatedAmount} available.`
                );
            }

            // Process each allocation
            for (const allocation of data.allocations) {
                const invoice = await Invoice.findById(allocation.invoiceId).session(session);
                if (!invoice) {
                    throw new Error(`Invoice ${allocation.invoiceId} not found`);
                }

                // Validate: Invoice must belong to same customer
                if (invoice.customer.toString() !== payment.customer?.toString()) {
                    throw new Error('Invoice and payment must belong to the same customer');
                }

                // Calculate invoice balance
                const paidAmount = invoice.settlements?.reduce((sum, s) => sum + s.amount, 0) || 0;
                const balance = invoice.grandTotal - paidAmount;

                // Validate: Cannot allocate more than invoice balance
                if (allocation.amount > balance) {
                    throw new Error(
                        `Cannot allocate ₹${allocation.amount} to invoice ${invoice.invoiceNumber}. Balance is ₹${balance}.`
                    );
                }

                // Add settlement to invoice
                if (!invoice.settlements) {
                    invoice.settlements = [];
                }
                invoice.settlements.push({
                    paymentId: payment._id as any,
                    amount: allocation.amount,
                    date: new Date().toISOString().split('T')[0]
                });

                // Update invoice status
                const newPaidAmount = paidAmount + allocation.amount;
                if (newPaidAmount >= invoice.grandTotal) {
                    invoice.status = InvoiceStatus.PAID;
                } else if (newPaidAmount > 0) {
                    invoice.status = InvoiceStatus.PARTIALLY_PAID;
                }

                await invoice.save({ session });

                // Add settlement to payment
                if (!payment.settlements) {
                    payment.settlements = [];
                }
                payment.settlements.push({
                    invoiceId: invoice._id as any,
                    amount: allocation.amount,
                    date: new Date().toISOString().split('T')[0]
                });
            }

            // Update payment allocation tracking
            payment.allocatedAmount = (payment.allocatedAmount || 0) + totalAllocation;
            payment.unallocatedAmount = (payment.unallocatedAmount || payment.amount) - totalAllocation;

            if (payment.unallocatedAmount === 0) {
                payment.status = 'fully-allocated';
            } else if (payment.allocatedAmount > 0) {
                payment.status = 'partially-allocated';
            }

            await payment.save({ session });

            // Update customer balances
            const customer = await Customer.findById(payment.customer).session(session);
            if (customer) {
                customer.advancePayments = (customer.advancePayments || 0) - totalAllocation;
                // CreditBalance increases (becomes less negative) as advance is used
                customer.creditBalance = (customer.creditBalance || 0) + totalAllocation;
                await customer.save({ session });
            }

            await session.commitTransaction();

            return await Payment.findById(payment._id)
                .populate('customer')
                .populate('settlements.invoiceId');
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Record a bulk payment and distribute across multiple invoices
     */
    static async recordBulkPayment(data: {
        customerId: string;
        amount: number;
        date: string;
        mode: PaymentMode;
        referenceNo?: string;
        notes?: string;
        allocations: {
            invoiceId: string;
            amount: number;
        }[];
        // TDS fields
        tdsAmount?: number;
        tdsDate?: string;
    }) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Get next payment number
            let numbering = await Numbering.findOne({ type: 'payment' });
            if (!numbering) {
                numbering = new Numbering({
                    type: 'payment',
                    startingNumber: 1,
                    currentNumber: 1,
                    prefix: 'PAY'
                });
            }
            const paymentNumber = numbering.currentNumber;
            numbering.currentNumber += 1;
            await numbering.save({ session });

            // Calculate total allocation
            const totalAllocation = data.allocations.reduce((sum, a) => sum + a.amount, 0);

            // Validate: Total allocation cannot exceed payment amount
            if (totalAllocation > data.amount) {
                throw new Error(
                    `Total allocation (₹${totalAllocation}) exceeds payment amount (₹${data.amount})`
                );
            }

            const grossAmount = data.amount + (data.tdsAmount || 0);

            // Determine if this is fully allocated or has excess (becomes advance)
            const unallocated = grossAmount - totalAllocation;
            const isFullyAllocated = unallocated === 0;
            const hasAdvance = unallocated > 0;

            // Create payment record
            const payment = new Payment({
                paymentNumber,
                customer: data.customerId,
                date: data.date,
                amount: data.amount,
                type: totalAllocation > 0 ? PaymentType.PAYMENT : PaymentType.ADVANCE,
                mode: data.mode,
                referenceNo: data.referenceNo,
                notes: data.notes,
                // TDS fields
                tdsApplicable: !!data.tdsAmount,
                tdsAmount: data.tdsAmount || 0,
                tdsDate: data.tdsDate || data.date,
                allocationType: hasAdvance ? 'multi-invoice' : 'multi-invoice',
                isAdvancePayment: hasAdvance,
                allocatedAmount: totalAllocation,
                unallocatedAmount: unallocated,
                status: isFullyAllocated ? 'fully-allocated' : (totalAllocation > 0 ? 'partially-allocated' : 'unallocated'),
                settlements: []
            });

            // Process each allocation
            for (const allocation of data.allocations) {
                const invoice = await Invoice.findById(allocation.invoiceId).session(session);
                if (!invoice) {
                    throw new Error(`Invoice ${allocation.invoiceId} not found`);
                }

                // Validate: Invoice must belong to same customer
                if (invoice.customer.toString() !== data.customerId) {
                    throw new Error('All invoices must belong to the same customer');
                }

                // Calculate invoice balance
                const paidAmount = invoice.settlements?.reduce((sum, s) => sum + s.amount, 0) || 0;
                const balance = invoice.grandTotal - paidAmount;

                // Validate: Cannot allocate more than invoice balance
                if (allocation.amount > balance) {
                    throw new Error(
                        `Cannot allocate ₹${allocation.amount} to invoice ${invoice.invoiceNumber}. Balance is ₹${balance}.`
                    );
                }

                // Add settlement to invoice
                if (!invoice.settlements) {
                    invoice.settlements = [];
                }
                invoice.settlements.push({
                    paymentId: payment._id as any,
                    amount: allocation.amount,
                    date: data.date
                });

                // Update invoice status
                const newPaidAmount = paidAmount + allocation.amount;
                if (newPaidAmount >= invoice.grandTotal) {
                    invoice.status = InvoiceStatus.PAID;
                } else if (newPaidAmount > 0) {
                    invoice.status = InvoiceStatus.PARTIALLY_PAID;
                }

                await invoice.save({ session });

                // Add settlement to payment
                payment.settlements.push({
                    invoiceId: invoice._id as any,
                    amount: allocation.amount,
                    date: data.date
                });
            }

            await payment.save({ session });

            // Update customer balances
            const customer = await Customer.findById(data.customerId).session(session);
            if (customer) {
                if (hasAdvance) {
                    customer.advancePayments = (customer.advancePayments || 0) + unallocated;
                }
                // Credit balance changes: payment reduces what customer owes (includes TDS)
                const totalSettlement = data.amount + (data.tdsAmount || 0);
                customer.creditBalance = (customer.creditBalance || 0) - totalSettlement + totalAllocation;
                customer.lastPaymentDate = data.date;
                await customer.save({ session });
            }

            await session.commitTransaction();

            return await Payment.findById(payment._id)
                .populate('customer')
                .populate('settlements.invoiceId');
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Get comprehensive customer account summary
     */
    static async getCustomerAccountSummary(customerId: string) {
        try {
            // Get customer
            const customer = await Customer.findById(customerId);
            if (!customer) {
                throw new Error('Customer not found');
            }

            // Get all unpaid/partially paid invoices
            const unpaidInvoices = await Invoice.find({
                customer: customerId,
                status: { $in: ['Unpaid', 'Partially Paid'] }
            }).sort({ date: -1 });

            // Calculate total outstanding
            let totalOutstanding = 0;
            const invoiceDetails = unpaidInvoices.map(invoice => {
                const paidAmount = invoice.settlements?.reduce((sum, s) => sum + s.amount, 0) || 0;
                const balance = invoice.grandTotal - paidAmount;
                totalOutstanding += balance;

                return {
                    invoiceId: invoice._id,
                    invoiceNumber: invoice.invoiceNumber,
                    date: invoice.date,
                    grandTotal: invoice.grandTotal,
                    paidAmount,
                    balance,
                    status: invoice.status
                };
            });

            // Get unallocated payments
            const unallocatedPayments = await Payment.find({
                customer: customerId,
                status: { $in: ['unallocated', 'partially-allocated'] },
                unallocatedAmount: { $gt: 0 }
            }).sort({ date: -1 });

            // Calculate total advance
            const totalAdvance = unallocatedPayments.reduce(
                (sum, p) => sum + (p.unallocatedAmount || 0),
                0
            );

            // Get recent payment history
            const recentPayments = await Payment.find({
                customer: customerId
            })
                .sort({ date: -1 })
                .limit(10)
                .populate('settlements.invoiceId');

            return {
                customer: {
                    id: customer._id,
                    name: customer.name,
                    creditBalance: customer.creditBalance || 0,
                    totalOutstanding: customer.totalOutstanding || totalOutstanding,
                    advancePayments: customer.advancePayments || totalAdvance,
                    creditLimit: customer.creditLimit,
                    lastPaymentDate: customer.lastPaymentDate
                },
                unpaidInvoices: invoiceDetails,
                unallocatedPayments: unallocatedPayments.map(p => ({
                    paymentId: p._id,
                    paymentNumber: p.paymentNumber,
                    date: p.date,
                    amount: p.amount,
                    allocatedAmount: p.allocatedAmount || 0,
                    unallocatedAmount: p.unallocatedAmount || 0,
                    mode: p.mode,
                    referenceNo: p.referenceNo,
                    status: p.status
                })),
                recentPayments: recentPayments.map(p => ({
                    paymentId: p._id,
                    paymentNumber: p.paymentNumber,
                    date: p.date,
                    amount: p.amount,
                    type: p.type,
                    mode: p.mode,
                    status: p.status,
                    allocations: p.settlements?.map(s => ({
                        invoiceId: s.invoiceId,
                        amount: s.amount,
                        date: s.date
                    })) || []
                })),
                summary: {
                    totalOutstanding,
                    totalAdvance,
                    netBalance: totalOutstanding - totalAdvance, // What customer effectively owes
                    unpaidInvoiceCount: unpaidInvoices.length,
                    unallocatedPaymentCount: unallocatedPayments.length
                }
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get list of unallocated payments for a customer
     */
    static async getUnallocatedPayments(customerId: string) {
        try {
            const payments = await Payment.find({
                customer: customerId,
                status: { $in: ['unallocated', 'partially-allocated'] },
                unallocatedAmount: { $gt: 0 }
            })
                .sort({ date: -1 })
                .populate('customer');

            return payments.map(p => ({
                paymentId: p._id,
                paymentNumber: p.paymentNumber,
                date: p.date,
                amount: p.amount,
                allocatedAmount: p.allocatedAmount || 0,
                unallocatedAmount: p.unallocatedAmount || 0,
                mode: p.mode,
                referenceNo: p.referenceNo,
                notes: p.notes,
                status: p.status,
                customer: p.customer
            }));
        } catch (error) {
            throw error;
        }
    }

    /**
     * Reverse a payment allocation (for corrections)
     */
    static async reverseAllocation(data: {
        paymentId: string;
        invoiceId: string;
    }) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Get payment
            const payment = await Payment.findById(data.paymentId).session(session);
            if (!payment) {
                throw new Error('Payment not found');
            }

            // Get invoice
            const invoice = await Invoice.findById(data.invoiceId).session(session);
            if (!invoice) {
                throw new Error('Invoice not found');
            }

            // Find the settlement in payment
            const paymentSettlement = payment.settlements?.find(
                s => s.invoiceId.toString() === data.invoiceId
            );
            if (!paymentSettlement) {
                throw new Error('Allocation not found in payment');
            }

            // Find the settlement in invoice
            const invoiceSettlement = invoice.settlements?.find(
                s => s.paymentId.toString() === data.paymentId
            );
            if (!invoiceSettlement) {
                throw new Error('Allocation not found in invoice');
            }

            const allocationAmount = paymentSettlement.amount;

            // Remove settlement from payment
            payment.settlements = payment.settlements?.filter(
                s => s.invoiceId.toString() !== data.invoiceId
            );

            // Update payment allocation tracking
            payment.allocatedAmount = (payment.allocatedAmount || 0) - allocationAmount;
            payment.unallocatedAmount = (payment.unallocatedAmount || 0) + allocationAmount;

            if (payment.unallocatedAmount === payment.amount) {
                payment.status = 'unallocated';
            } else if (payment.unallocatedAmount > 0) {
                payment.status = 'partially-allocated';
            } else {
                payment.status = 'fully-allocated';
            }

            await payment.save({ session });

            // Remove settlement from invoice
            invoice.settlements = invoice.settlements?.filter(
                s => s.paymentId.toString() !== data.paymentId
            );

            // Recalculate invoice status
            const paidAmount = invoice.settlements?.reduce((sum, s) => sum + s.amount, 0) || 0;
            if (paidAmount === 0) {
                invoice.status = InvoiceStatus.UNPAID;
            } else if (paidAmount >= invoice.grandTotal) {
                invoice.status = InvoiceStatus.PAID;
            } else {
                invoice.status = InvoiceStatus.PARTIALLY_PAID;
            }

            await invoice.save({ session });

            // Update customer balances
            const customer = await Customer.findById(payment.customer).session(session);
            if (customer) {
                customer.advancePayments = (customer.advancePayments || 0) + allocationAmount;
                customer.creditBalance = (customer.creditBalance || 0) - allocationAmount;
                await customer.save({ session });
            }

            await session.commitTransaction();

            return {
                success: true,
                message: `Allocation of ₹${allocationAmount} reversed successfully`
            };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }
}
