
import React, { useEffect, useState } from 'react';
import { CustomerAccountSummary as AccountSummaryType } from '../../types/paymentAllocation';
import { PaymentAllocationService } from '../../services/paymentAllocationService';

interface CustomerAccountSummaryProps {
    customerId: string;
    onRefresh?: () => void;
    onAllocate?: (payment: any) => void;
}

export const CustomerAccountSummary: React.FC<CustomerAccountSummaryProps> = ({
    customerId,
    onRefresh,
    onAllocate
}) => {
    const [summary, setSummary] = useState<AccountSummaryType | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSummary = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await PaymentAllocationService.getCustomerAccountSummary(customerId);
            setSummary(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load account summary');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (customerId) {
            fetchSummary();
        }
    }, [customerId, onRefresh]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="p-4 bg-white rounded-lg shadow animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="h-20 bg-gray-200 rounded"></div>
                    <div className="h-20 bg-gray-200 rounded"></div>
                    <div className="h-20 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
                Error: {error}
            </div>
        );
    }

    if (!summary) return null;

    return (
        <div className="space-y-4 max-w-[1600px] mx-auto">
            {/* Financial Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-white p-2.5 rounded shadow-sm border-l-4 border-blue-500">
                    <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-tight">Total Outstanding</h3>
                    <p className="text-lg font-black text-gray-900 leading-tight">
                        {formatCurrency(summary.summary.totalOutstanding)}
                    </p>
                    <p className="text-[10px] text-gray-500 font-medium">
                        {summary.summary.unpaidInvoiceCount} unpaid invoices
                    </p>
                </div>

                <div className="bg-white p-2.5 rounded shadow-sm border-l-4 border-green-500">
                    <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-tight">Advance Balance</h3>
                    <p className="text-lg font-black text-gray-900 leading-tight">
                        {formatCurrency(summary.summary.totalAdvance)}
                    </p>
                    <p className="text-[10px] text-gray-500 font-medium">
                        {summary.summary.unallocatedPaymentCount} unallocated payments
                    </p>
                </div>

                <div className="bg-white p-2.5 rounded shadow-sm border-l-4 border-purple-500">
                    <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-tight">Net Payable</h3>
                    <p className="text-lg font-black text-gray-900 leading-tight">
                        {formatCurrency(summary.summary.netBalance)}
                    </p>
                    <p className="text-[10px] text-gray-500 font-medium">
                        (Outstanding - Advance)
                    </p>
                </div>

                <div className="bg-white p-2.5 rounded shadow-sm border-l-4 border-gray-500">
                    <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-tight">Ledger Balance</h3>
                    <p className={`text-lg font-black leading-tight ${summary.customer.creditBalance < 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(summary.customer.creditBalance))}
                        <span className="text-xs ml-1 font-bold">{summary.customer.creditBalance < 0 ? 'Cr' : 'Dr'}</span>
                    </p>
                </div>
            </div>

            {/* Unallocated Payments Section */}
            {summary.unallocatedPayments.length > 0 && (
                <div className="bg-white rounded shadow-sm overflow-hidden border border-gray-100">
                    <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Unallocated Payments</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-1.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-1.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ref No</th>
                                    <th className="px-4 py-1.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-4 py-1.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Unallocated</th>
                                    <th className="px-4 py-1.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-20">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {summary.unallocatedPayments.map((payment) => (
                                    <tr key={payment.paymentId} className="hover:bg-gray-50">
                                        <td className="px-4 py-1.5 whitespace-nowrap text-xs text-gray-600">
                                            {new Date(payment.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-1.5 whitespace-nowrap text-xs text-gray-900 font-medium">
                                            {payment.referenceNo || '-'}
                                        </td>
                                        <td className="px-4 py-1.5 whitespace-nowrap text-xs text-gray-900">
                                            {formatCurrency(payment.amount)}
                                        </td>
                                        <td className="px-4 py-1.5 whitespace-nowrap text-xs font-bold text-green-700">
                                            {formatCurrency(payment.unallocatedAmount)}
                                        </td>
                                        <td className="px-4 py-1.5 whitespace-nowrap text-xs font-bold">
                                            <button
                                                className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded text-[10px] uppercase font-bold"
                                                onClick={() => onAllocate?.(payment)}
                                            >
                                                Allocate
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Unpaid Invoices Preview */}
            <div className="bg-white rounded shadow-sm overflow-hidden border border-gray-100">
                <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Unpaid Invoices</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-1.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-1.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Invoice No</th>
                                <th className="px-4 py-1.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total</th>
                                <th className="px-4 py-1.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Balance</th>
                                <th className="px-4 py-1.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {summary.unpaidInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-4 text-center text-xs text-gray-500">
                                        No unpaid invoices
                                    </td>
                                </tr>
                            ) : (
                                summary.unpaidInvoices.map((invoice) => (
                                    <tr key={invoice.invoiceId} className="hover:bg-gray-50">
                                        <td className="px-4 py-1.5 whitespace-nowrap text-xs text-gray-600">
                                            {new Date(invoice.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-1.5 whitespace-nowrap text-xs font-bold text-gray-900">
                                            {invoice.invoiceNumber}
                                        </td>
                                        <td className="px-4 py-1.5 whitespace-nowrap text-xs text-gray-600">
                                            {formatCurrency(invoice.grandTotal)}
                                        </td>
                                        <td className="px-4 py-1.5 whitespace-nowrap text-xs font-black text-red-700">
                                            {formatCurrency(invoice.balance)}
                                        </td>
                                        <td className="px-4 py-1.5 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 inline-flex text-[10px] leading-4 font-bold rounded-full uppercase ${invoice.status === 'Paid' ? 'bg-green-100 text-green-800' :
                                                invoice.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                {invoice.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
