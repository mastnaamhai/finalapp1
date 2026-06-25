import React, { useState, useEffect } from 'react';
import { PaymentAllocationService } from '../../services/paymentAllocationService';
import { InvoiceSummary, PaymentSummary } from '../../types/paymentAllocation';

interface PaymentAllocationProps {
    payment: PaymentSummary;
    onSuccess: () => void;
    onCancel: () => void;
}

export const PaymentAllocation: React.FC<PaymentAllocationProps> = ({
    payment,
    onSuccess,
    onCancel
}) => {
    const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
    const [allocations, setAllocations] = useState<{ [key: string]: number }>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchUnpaidInvoices();
    }, [payment.customer]);

    const fetchUnpaidInvoices = async () => {
        try {
            setLoading(true);
            // We can use getCustomerAccountSummary to get unpaid invoices
            // In a real app, might want a specific endpoint for just invoices to reduce payload
            const summary = await PaymentAllocationService.getCustomerAccountSummary(payment.customer._id || payment.customer);
            setInvoices(summary.unpaidInvoices);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch invoices');
        } finally {
            setLoading(false);
        }
    };

    const handleAllocationChange = (invoiceId: string, amount: string) => {
        const value = parseFloat(amount) || 0;
        setAllocations(prev => ({
            ...prev,
            [invoiceId]: value
        }));
    };

    const calculateTotalAllocation = () => {
        return Object.values(allocations).reduce((sum, amount) => sum + amount, 0);
    };

    const calculateRemaining = () => {
        return payment.unallocatedAmount - calculateTotalAllocation();
    };

    const handleSubmit = async () => {
        try {
            setSubmitting(true);
            setError(null);

            const allocationFormatted = Object.entries(allocations)
                .filter(([_, amount]) => amount > 0)
                .map(([invoiceId, amount]) => ({
                    invoiceId,
                    amount
                }));

            if (allocationFormatted.length === 0) {
                setError('Please allocate amount to at least one invoice');
                setSubmitting(false);
                return;
            }

            const total = calculateTotalAllocation();
            if (total > payment.unallocatedAmount) {
                setError(`Total allocation (₹${total}) exceeds available amount (₹${payment.unallocatedAmount})`);
                setSubmitting(false);
                return;
            }

            await PaymentAllocationService.allocatePayment(payment.paymentId, allocationFormatted);
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Failed to submit allocation');
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    if (loading) {
        return <div className="p-4 text-center">Loading invoices...</div>;
    }

    const remainingAmount = calculateRemaining();
    const isOverAllocated = remainingAmount < 0;

    return (
        <div className="bg-white rounded-lg shadow-lg max-w-4xl mx-auto flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center rounded-t-lg">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Allocate Payment</h2>
                    <p className="text-sm text-gray-500">
                        Payment #{payment.paymentNumber} • {new Date(payment.date).toLocaleDateString()}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-500">Available to Allocate</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(payment.unallocatedAmount)}</p>
                </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
                {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded border border-red-200">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-40">Allocate</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                        No unpaid invoices found for this customer.
                                    </td>
                                </tr>
                            ) : (
                                invoices.map((invoice) => {
                                    const currentAllocation = allocations[invoice.invoiceId] || 0;
                                    const remainingInvoiceBalance = invoice.balance - currentAllocation;
                                    const isFullyPaid = remainingInvoiceBalance <= 0;

                                    return (
                                        <tr key={invoice.invoiceId} className={currentAllocation > 0 ? 'bg-blue-50' : ''}>
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                {invoice.invoiceNumber}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                {new Date(invoice.date).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500 text-right">
                                                {formatCurrency(invoice.grandTotal)}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-bold text-gray-700 text-right">
                                                {formatCurrency(invoice.balance)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={invoice.balance}
                                                    className={`w-32 px-2 py-1 border rounded text-right focus:ring-2 focus:ring-indigo-500 outline-none ${currentAllocation > invoice.balance ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                                        }`}
                                                    placeholder="0.00"
                                                    value={allocations[invoice.invoiceId] || ''}
                                                    onChange={(e) => handleAllocationChange(invoice.invoiceId, e.target.value)}
                                                />
                                                {remainingInvoiceBalance < 0 && (
                                                    <p className="text-xs text-red-600 mt-1">Exceeds balance</p>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                <div className="flex justify-between items-center mb-4">
                    <div className="text-sm font-medium text-gray-700">
                        Selected Invoices: {Object.values(allocations).filter(v => v > 0).length}
                    </div>
                    <div className="flex gap-8 text-right">
                        <div>
                            <p className="text-xs text-gray-500">Total Allocated</p>
                            <p className="text-lg font-bold text-gray-900">{formatCurrency(calculateTotalAllocation())}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Remaining Payment</p>
                            <p className={`text-lg font-bold ${isOverAllocated ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(remainingAmount)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || isOverAllocated || invoices.length === 0}
                        className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${submitting || isOverAllocated || invoices.length === 0
                                ? 'bg-indigo-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                    >
                        {submitting ? 'Processing...' : 'Confirm Allocation'}
                    </button>
                </div>
            </div>
        </div>
    );
};
