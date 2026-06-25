import React, { useState, useMemo } from 'react';
import type { Payment, Customer, Invoice } from '../../types';
import { TDSService, type DateRange } from '../../services/tdsService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

interface TDSSummaryProps {
    payments: Payment[];
    customers: Customer[];
    invoices: Invoice[];
}

type SortField = 'clientName' | 'totalTDSAmount' | 'totalGrossAmount' | 'transactionCount' | 'lastTDSDate';
type SortDirection = 'asc' | 'desc';

export const TDSSummary: React.FC<TDSSummaryProps> = ({ payments, customers, invoices }) => {
    const [filters, setFilters] = useState<DateRange>({
        startDate: TDSService.getFinancialYearRange(TDSService.getCurrentFinancialYear()).startDate,
        endDate: TDSService.getFinancialYearRange(TDSService.getCurrentFinancialYear()).endDate
    });

    const [selectedFY, setSelectedFY] = useState<string>(TDSService.getCurrentFinancialYear());
    const [sortField, setSortField] = useState<SortField>('totalTDSAmount');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [showTransactions, setShowTransactions] = useState<boolean>(false);

    // Calculate TDS data
    const totalTDS = useMemo(() =>
        TDSService.calculateTotalTDS(payments, filters),
        [payments, filters]
    );

    const clientSummaries = useMemo(() => {
        const summaries = TDSService.getClientWiseTDS(payments, customers, filters);

        // Apply sorting
        return summaries.sort((a, b) => {
            let comparison = 0;

            switch (sortField) {
                case 'clientName':
                    comparison = a.clientName.localeCompare(b.clientName);
                    break;
                case 'totalTDSAmount':
                    comparison = a.totalTDSAmount - b.totalTDSAmount;
                    break;
                case 'totalGrossAmount':
                    comparison = a.totalGrossAmount - b.totalGrossAmount;
                    break;
                case 'transactionCount':
                    comparison = a.transactionCount - b.transactionCount;
                    break;
                case 'lastTDSDate':
                    comparison = new Date(a.lastTDSDate).getTime() - new Date(b.lastTDSDate).getTime();
                    break;
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [payments, customers, filters, sortField, sortDirection]);

    const transactions = useMemo(() =>
        TDSService.getTDSTransactions(payments, customers, invoices, filters),
        [payments, customers, invoices, filters]
    );

    const totalGross = useMemo(() =>
        clientSummaries.reduce((sum, s) => sum + s.totalGrossAmount, 0),
        [clientSummaries]
    );

    const transactionCount = useMemo(() =>
        clientSummaries.reduce((sum, s) => sum + s.transactionCount, 0),
        [clientSummaries]
    );

    const averageRate = useMemo(() =>
        totalGross > 0 ? (totalTDS / totalGross) * 100 : 0,
        [totalTDS, totalGross]
    );

    const handleFYChange = (fy: string) => {
        setSelectedFY(fy);
        if (fy === 'custom') {
            // Keep current custom dates
            return;
        }
        const range = TDSService.getFinancialYearRange(fy);
        setFilters(range);
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const handleExport = () => {
        TDSService.exportTDSSummaryToExcel(
            clientSummaries,
            transactions,
            `TDS_Summary_${selectedFY}`
        );
    };

    const getSortIcon = (field: SortField) => {
        if (sortField !== field) return '↕';
        return sortDirection === 'asc' ? '↑' : '↓';
    };



    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-gray-800">TDS Summary Report</h2>
                <Button variant="secondary" onClick={handleExport}>
                    Export to Excel
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Financial Year</label>
                        <Select
                            value={selectedFY}
                            onChange={(e) => handleFYChange(e.target.value)}
                        >
                            {TDSService.getFinancialYearOptions().map(fy => (
                                <option key={fy} value={fy}>FY {fy}</option>
                            ))}
                            <option value="custom">Custom Range</option>
                        </Select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <Input
                            type="date"
                            value={filters.startDate || ''}
                            onChange={(e) => {
                                setFilters(prev => ({ ...prev, startDate: e.target.value }));
                                setSelectedFY('custom');
                            }}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <Input
                            type="date"
                            value={filters.endDate || ''}
                            onChange={(e) => {
                                setFilters(prev => ({ ...prev, endDate: e.target.value }));
                                setSelectedFY('custom');
                            }}
                        />
                    </div>
                    <div className="flex items-end">
                        <Button
                            variant={showTransactions ? 'primary' : 'secondary'}
                            onClick={() => setShowTransactions(!showTransactions)}
                            className="w-full"
                        >
                            {showTransactions ? 'Hide' : 'Show'} Transactions
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                    <div className="text-center">
                        <p className="text-sm text-gray-600 mb-2">Total TDS Deducted</p>
                        <p className="text-3xl font-bold text-red-600">
                            {TDSService.formatCurrency(totalTDS)}
                        </p>
                    </div>
                </Card>
                <Card>
                    <div className="text-center">
                        <p className="text-sm text-gray-600 mb-2">Total Gross Amount</p>
                        <p className="text-3xl font-bold text-blue-600">
                            {TDSService.formatCurrency(totalGross)}
                        </p>
                    </div>
                </Card>
                <Card>
                    <div className="text-center">
                        <p className="text-sm text-gray-600 mb-2">Average TDS Rate</p>
                        <p className="text-3xl font-bold text-purple-600">
                            {averageRate.toFixed(2)}%
                        </p>
                    </div>
                </Card>
                <Card>
                    <div className="text-center">
                        <p className="text-sm text-gray-600 mb-2">Total Transactions</p>
                        <p className="text-3xl font-bold text-green-600">
                            {transactionCount}
                        </p>
                    </div>
                </Card>
            </div>

            {/* Client-wise Summary Table */}
            <Card title="Client-wise TDS Summary">
                {clientSummaries.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('clientName')}
                                    >
                                        Client Name {getSortIcon('clientName')}
                                    </th>
                                    <th
                                        className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('totalGrossAmount')}
                                    >
                                        Gross Amount {getSortIcon('totalGrossAmount')}
                                    </th>
                                    <th
                                        className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('totalTDSAmount')}
                                    >
                                        TDS Deducted {getSortIcon('totalTDSAmount')}
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Avg Rate (%)
                                    </th>
                                    <th
                                        className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('transactionCount')}
                                    >
                                        Transactions {getSortIcon('transactionCount')}
                                    </th>
                                    <th
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('lastTDSDate')}
                                    >
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {clientSummaries.map((summary, index) => (
                                    <tr key={summary.clientId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                            {summary.clientName}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right text-blue-600">
                                            {TDSService.formatCurrency(summary.totalGrossAmount)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                                            {TDSService.formatCurrency(summary.totalTDSAmount)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right text-purple-600">
                                            {summary.averageTDSRate.toFixed(2)}%
                                        </td>
                                        <td className="px-4 py-3 text-sm text-center text-gray-600">
                                            {summary.transactionCount}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                        </td>
                                    </tr>
                                ))}
                                {/* Totals Row */}
                                <tr className="bg-blue-50 font-bold">
                                    <td className="px-4 py-3 text-sm text-gray-900">
                                        TOTAL
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-blue-700">
                                        {TDSService.formatCurrency(totalGross)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-red-700">
                                        {TDSService.formatCurrency(totalTDS)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-purple-700">
                                        {averageRate.toFixed(2)}%
                                    </td>
                                    <td className="px-4 py-3 text-sm text-center text-gray-700">
                                        {transactionCount}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">
                                        -
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <div className="text-gray-400 mb-2">
                            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <p className="text-lg">No TDS transactions found</p>
                        <p className="text-sm">TDS deductions will appear here once recorded</p>
                    </div>
                )
                }
            </Card >

            {/* Detailed Transactions Table */}
            {
                showTransactions && (
                    <Card title="Detailed TDS Transactions">
                        {transactions.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Date
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Client
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Payment Ref
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Invoice Ref
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Gross Amount
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                TDS Rate
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                TDS Amount
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Net Received
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {transactions.map((txn, index) => (
                                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {TDSService.formatDate(txn.date)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {txn.clientName}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {txn.paymentReference}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {txn.invoiceReference || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right text-blue-600">
                                                    {TDSService.formatCurrency(txn.grossAmount)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right text-purple-600">
                                                    {txn.tdsRate.toFixed(2)}%
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                                                    {TDSService.formatCurrency(txn.tdsAmount)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right text-green-600">
                                                    {TDSService.formatCurrency(txn.netAmount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <p>No transactions to display</p>
                            </div>
                        )}
                    </Card>
                )
            }
        </div >
    );
};
