import { API_BASE_URL } from '../constants';
import { CustomerAccountSummary, PaymentSummary } from '../types/paymentAllocation';

export const PaymentAllocationService = {
    /**
     * Record an advance payment
     */
    async recordAdvancePayment(data: any) {
        const response = await fetch(`${API_BASE_URL}/payments/advance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to record advance payment');
        }
        return response.json();
    },

    /**
     * Allocate payment to invoices
     */
    async allocatePayment(paymentId: string, allocations: { invoiceId: string; amount: number }[]) {
        const response = await fetch(`${API_BASE_URL}/payments/${paymentId}/allocate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ allocations }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to allocate payment');
        }
        return response.json();
    },

    /**
     * Record bulk payment
     */
    async recordBulkPayment(data: any) {
        const response = await fetch(`${API_BASE_URL}/payments/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to record bulk payment');
        }
        return response.json();
    },

    /**
     * Get customer account summary
     */
    async getCustomerAccountSummary(customerId: string): Promise<CustomerAccountSummary> {
        const response = await fetch(`${API_BASE_URL}/customers/${customerId}/account-summary`);
        if (!response.ok) {
            throw new Error('Failed to fetch account summary');
        }
        return response.json();
    },

    /**
     * Get unallocated payments
     */
    async getUnallocatedPayments(customerId: string): Promise<PaymentSummary[]> {
        const response = await fetch(`${API_BASE_URL}/customers/${customerId}/unallocated-payments`);
        if (!response.ok) {
            throw new Error('Failed to fetch unallocated payments');
        }
        return response.json();
    },

    /**
     * Reverse allocation
     */
    async reverseAllocation(paymentId: string, invoiceId: string) {
        const response = await fetch(`${API_BASE_URL}/payments/${paymentId}/reverse-allocation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ invoiceId }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to reverse allocation');
        }
        return response.json();
    }
};
