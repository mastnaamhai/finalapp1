import React, { useState, useEffect } from 'react';
import { PaymentAllocationService } from '../../services/paymentAllocationService';
import { PaymentMode } from '../../types';
import { InvoiceSummary } from '../../types/paymentAllocation';

interface BulkPaymentFormProps {
    customerId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export const BulkPaymentForm: React.FC<BulkPaymentFormProps> = ({
    customerId,
    onSuccess,
    onCancel
}) => {
    const today = new Date().toISOString().split('T')[0];

    const [formData, setFormData] = useState({
        date: today,
        amount: '',
        mode: 'Bank Transfer' as PaymentMode,
        referenceNo: '',
        notes: ''
    });

    const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
    const [allocations, setAllocations] = useState<{ [key: string]: number }>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchUnpaidInvoices();
    }, [customerId]);

    const fetchUnpaidInvoices = async () => {
        try {
            setLoading(true);
            const summary = await PaymentAllocationService.getCustomerAccountSummary(customerId);
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

    const getPaymentAmount = () => parseFloat(formData.amount) || 0;

    const calculateResult = () => {
        const totalAllocated = calculateTotalAllocation();
        const payAmount = getPaymentAmount();
        const remaining = payAmount - totalAllocated;

        return { totalAllocated, remaining, isOverAllocated: remaining < 0 };
    };

    const autoAllocate = () => {
        const payAmount = getPaymentAmount();
        if (payAmount <= 0) return;

        let remainingToAllocate = payAmount;
        const newAllocations: { [key: string]: number } = {};

        // Allocate to oldest invoices first (assuming invoices are already sorted by date desc, need to reverse or sort asc)
        // Actually typically we pay oldest first. Let's sort logic locally if needed.
        const sortedInvoices = [...invoices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        for (const invoice of sortedInvoices) {
            if (remainingToAllocate <= 0) break;

            const allocateAmount = Math.min(invoice.balance, remainingToAllocate);
            newAllocations[invoice.invoiceId] = allocateAmount;
            remainingToAllocate -= allocateAmount;
        }

        setAllocations(newAllocations);
    };

    const handleSubmit = async () => {
        const payAmount = getPaymentAmount();
        if (payAmount <= 0) {
            setError('Please enter a valid payment amount');
            return;
        }

        const { isOverAllocated } = calculateResult();
        if (isOverAllocated) {
            setError('Total allocation exceeds payment amount');
            return;
        }

        try {
            setSubmitting(true);
            setError(null);

            const allocationFormatted = Object.entries(allocations)
                .filter(([_, amount]) => amount > 0)
                .map(([invoiceId, amount]) => ({
                    invoiceId,
                    amount
                }));

            await PaymentAllocationService.recordBulkPayment({
                customerId,
                amount: payAmount,
                date: formData.date,
                mode: formData.mode,
                referenceNo: formData.referenceNo,
                notes: formData.notes,
                allocations: allocationFormatted
            });

            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Failed to record bulk payment');
            setSubmitting(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    if (loading) return <div className="p-4 text-center">Loading invoices...</div>;

    const { totalAllocated, remaining, isOverAllocated } = calculateResult();

    return (
        <div className="bg-white rounded-lg shadow-lg max-w-4xl mx-auto flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-200 bg-purple-50 rounded-t-lg flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Bulk Payment</h2>
                    <p className="text-sm text-gray-500">One payment, multiple invoices</p>
                </div>
                <button
                    onClick={autoAllocate}
                    className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded hover:bg-purple-200"
                    disabled={!formData.amount}
                >
                    Auto-Allocate (Oldest First)
                </button>
            </div>

            <div className="flex flex-col md:flex-row h-full overflow-hidden">
                {/* Payment Details Sidebar */}
                <div className="w-full md:w-1/3 p-4 border-r border-gray-200 bg-gray-50 overflow-y-auto">
                    <h3 className="font-semibold text-gray-700 mb-4">Payment Details</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                            <input
                                type="date"
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md font-bold text-lg"
                                placeholder="0.00"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                            <select
                                value={formData.mode}
                                onChange={(e) => setFormData({ ...formData, mode: e.target.value as PaymentMode })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            >
                                <option value="Cash">Cash</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Cheque">Cheque</option>
                                <option value="UPI">UPI</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <div className={`p-3 rounded border ${isOverAllocated ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span>Total Amount:</span>
                                    <span className="font-bold">{formatCurrency(getPaymentAmount())}</span>
                                </div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span>Allocated:</span>
                                    <span className="font-bold">{formatCurrency(totalAllocated)}</span>
                                </div>
                                <div className="border-t border-gray-300 my-1 pt-1 flex justify-between font-bold">
                                    <span>{remaining < 0 ? 'Over-allocated:' : 'Remaining (Advance):'}</span>
                                    <span className={remaining < 0 ? 'text-red-600' : 'text-green-600'}>
                                        {formatCurrency(Math.abs(remaining))}
                                    </span>
                                </div>
                                {!isOverAllocated && remaining > 0 && (
                                    <p className="text-xs text-green-600 mt-1 italic">
                                        Running balance will be stored as advance payment.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Invoice Allocation Area */}
                <div className="w-full md:w-2/3 p-4 overflow-y-auto">
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded border border-red-200 text-sm">
                            {error}
                        </div>
                    )}

                    <h3 className="font-semibold text-gray-700 mb-4">Allocate to Invoices</h3>

                    <div className="space-y-2">
                        {invoices.length === 0 ? (
                            <p className="text-gray-500 italic">No unpaid invoices found.</p>
                        ) : (
                            invoices.map(invoice => {
                                const currentAllocation = allocations[invoice.invoiceId] || 0;
                                const balanceAfter = invoice.balance - currentAllocation;

                                return (
                                    <div key={invoice.invoiceId} className={`p-3 rounded border ${currentAllocation > 0 ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="font-bold text-gray-800 block">{invoice.invoiceNumber}</span>
                                                <span className="text-xs text-gray-500">{new Date(invoice.date).toLocaleDateString()}</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-bold text-gray-700">Bal: {formatCurrency(invoice.balance)}</div>
                                                <div className="text-xs text-gray-400">Total: {formatCurrency(invoice.grandTotal)}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-600 w-24">Allocate:</span>
                                            <input
                                                type="number"
                                                min="0"
                                                max={invoice.balance}
                                                value={allocations[invoice.invoiceId] || ''}
                                                onChange={(e) => handleAllocationChange(invoice.invoiceId, e.target.value)}
                                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-right focus:ring-purple-500 focus:border-purple-500"
                                                placeholder="0.00"
                                                disabled={!formData.amount}
                                            />
                                        </div>
                                        {balanceAfter < 0 && <p className="text-xs text-red-600 mt-1 text-right">Exceeds balance</p>}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end space-x-3">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    disabled={submitting}
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={submitting || isOverAllocated || !formData.amount}
                    className={`px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${submitting || isOverAllocated || !formData.amount
                            ? 'bg-purple-400 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                >
                    {submitting ? 'Processing...' : 'Record & Distribute'}
                </button>
            </div>
        </div>
    );
};
