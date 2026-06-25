import React, { useState } from 'react';
import { PaymentAllocationService } from '../../services/paymentAllocationService';
import { PaymentMode } from '../../types';

interface AdvancePaymentFormProps {
    customerId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export const AdvancePaymentForm: React.FC<AdvancePaymentFormProps> = ({
    customerId,
    onSuccess,
    onCancel
}) => {
    // Get date in YYYY-MM-DD format for input
    const today = new Date().toISOString().split('T')[0];

    const [formData, setFormData] = useState({
        date: today,
        amount: '',
        mode: 'Bank Transfer' as PaymentMode,
        referenceNo: '',
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        try {
            setSubmitting(true);
            setError(null);

            await PaymentAllocationService.recordAdvancePayment({
                customerId,
                amount: parseFloat(formData.amount),
                date: formData.date,
                mode: formData.mode,
                referenceNo: formData.referenceNo,
                notes: formData.notes
            });

            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Failed to record advance payment');
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg max-w-md mx-auto">
            <div className="p-4 border-b border-gray-200 bg-blue-50 rounded-t-lg">
                <h2 className="text-xl font-bold text-gray-800">Record Advance Payment</h2>
                <p className="text-sm text-gray-500">Add funds to customer account</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                    <div className="p-3 bg-red-100 text-red-700 rounded border border-red-200 text-sm">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                        type="date"
                        required
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 font-bold text-gray-900"
                        placeholder="0.00"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                    <select
                        value={formData.mode}
                        onChange={(e) => setFormData({ ...formData, mode: e.target.value as PaymentMode })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cheque">Cheque</option>
                        <option value="UPI">UPI</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reference No / UTR</label>
                    <input
                        type="text"
                        value={formData.referenceNo}
                        onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Optional"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                        rows={3}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Optional remarks"
                    />
                </div>

                <div className="pt-4 flex justify-end space-x-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${submitting ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        {submitting ? 'Recording...' : 'Record Payment'}
                    </button>
                </div>
            </form>
        </div>
    );
};
