import { PaymentMode, PaymentType } from '../types';

export interface Allocation {
    invoiceId: string;
    amount: number;
    date: string;
}

export interface PaymentSummary {
    paymentId: string;
    paymentNumber: number;
    date: string;
    amount: number;
    allocatedAmount: number;
    unallocatedAmount: number;
    mode: PaymentMode;
    referenceNo?: string;
    notes?: string;
    status: 'unallocated' | 'partially-allocated' | 'fully-allocated';
    type: PaymentType;
    allocations?: Allocation[];
    customer?: any;
}

export interface InvoiceSummary {
    invoiceId: string;
    invoiceNumber: string;
    date: string;
    grandTotal: number;
    paidAmount: number;
    balance: number;
    status: string;
}

export interface CustomerAccountSummary {
    customer: {
        id: string;
        name: string;
        creditBalance: number;
        totalOutstanding: number;
        advancePayments: number;
        creditLimit?: number;
        lastPaymentDate?: string;
    };
    unpaidInvoices: InvoiceSummary[];
    unallocatedPayments: PaymentSummary[];
    recentPayments: PaymentSummary[];
    summary: {
        totalOutstanding: number;
        totalAdvance: number;
        netBalance: number;
        unpaidInvoiceCount: number;
        unallocatedPaymentCount: number;
    };
}
