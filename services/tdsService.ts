import type { Payment, Customer, Invoice } from '../types';
import * as XLSX from 'xlsx';

export interface ClientTDSSummary {
    clientId: string;
    clientName: string;
    totalGrossAmount: number;
    totalTDSAmount: number;
    averageTDSRate: number;
    transactionCount: number;
    lastTDSDate: string;
}

export interface TDSTransaction {
    date: string;
    clientId: string;
    clientName: string;
    paymentReference: string;
    grossAmount: number;
    tdsRate: number;
    tdsAmount: number;
    netAmount: number;
    invoiceReference?: string;
}

export interface DateRange {
    startDate?: string;
    endDate?: string;
}

export class TDSService {
    /**
     * Calculate total TDS amount for given period
     */
    static calculateTotalTDS(payments: Payment[], filters?: DateRange): number {
        return payments
            .filter(p => this.filterByDateRange(p, filters))
            .filter(p => p.tdsAmount && p.tdsAmount > 0)
            .reduce((sum, p) => sum + (p.tdsAmount || 0), 0);
    }

    /**
     * Get client-wise TDS summary
     */
    static getClientWiseTDS(
        payments: Payment[],
        customers: Customer[],
        filters?: DateRange
    ): ClientTDSSummary[] {
        // Filter payments with TDS
        const tdsPayments = payments.filter(p =>
            p.tdsAmount &&
            p.tdsAmount > 0 &&
            this.filterByDateRange(p, filters)
        );

        // Group by customer
        const clientMap = new Map<string, {
            payments: Payment[];
            customer: Customer | undefined;
        }>();

        tdsPayments.forEach(payment => {
            const customerId = payment.customerId || (payment.customer as any)?._id;
            if (!customerId) return;

            if (!clientMap.has(customerId)) {
                const customer = customers.find(c => c._id === customerId);
                clientMap.set(customerId, { payments: [], customer });
            }
            clientMap.get(customerId)!.payments.push(payment);
        });

        // Calculate summary for each client
        const summaries: ClientTDSSummary[] = [];

        clientMap.forEach((data, clientId) => {
            const { payments: clientPayments, customer } = data;

            const totalTDSAmount = clientPayments.reduce((sum, p) => sum + (p.tdsAmount || 0), 0);
            const totalGrossAmount = clientPayments.reduce((sum, p) => {
                const gross = p.amount + (p.tdsAmount || 0);
                return sum + gross;
            }, 0);

            const totalRateWeighted = clientPayments.reduce((sum, p) => {
                return sum + ((p.tdsRate || 0) * (p.tdsAmount || 0));
            }, 0);
            const averageTDSRate = totalTDSAmount > 0 ? totalRateWeighted / totalTDSAmount : 0;

            const dates = clientPayments
                .map(p => p.tdsDate || p.date)
                .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

            summaries.push({
                clientId,
                clientName: customer?.name || 'Unknown Client',
                totalGrossAmount,
                totalTDSAmount,
                averageTDSRate,
                transactionCount: clientPayments.length,
                lastTDSDate: dates[0] || ''
            });
        });

        // Sort by total TDS amount (descending)
        return summaries.sort((a, b) => b.totalTDSAmount - a.totalTDSAmount);
    }

    /**
     * Get all TDS transactions with details
     */
    static getTDSTransactions(
        payments: Payment[],
        customers: Customer[],
        invoices: Invoice[],
        filters?: DateRange
    ): TDSTransaction[] {
        return payments
            .filter(p => p.tdsAmount && p.tdsAmount > 0)
            .filter(p => this.filterByDateRange(p, filters))
            .map(p => {
                const customerId = p.customerId || (p.customer as any)?._id;
                const customer = customers.find(c => c._id === customerId);
                const grossAmount = p.amount + (p.tdsAmount || 0);

                let invoiceReference = '';
                if (p.invoiceId) {
                    const invoice = invoices.find(inv => inv._id === p.invoiceId);
                    if (invoice) {
                        invoiceReference = `INV-${invoice.invoiceNumber}`;
                    }
                }

                return {
                    date: p.tdsDate || p.date,
                    clientId: customerId || '',
                    clientName: customer?.name || 'Unknown Client',
                    paymentReference: p.referenceNo || `PAY-${p._id.slice(-6)}`,
                    grossAmount,
                    tdsRate: p.tdsRate || 0,
                    tdsAmount: p.tdsAmount || 0,
                    netAmount: p.amount,
                    invoiceReference
                };
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    /**
     * Get financial year date range
     */
    static getFinancialYearRange(fy: string): DateRange {
        // FY format: "2024-25" means Apr 1, 2024 to Mar 31, 2025
        const [startYear, endYear] = fy.split('-').map(y => parseInt(y));
        const fullStartYear = startYear < 100 ? 2000 + startYear : startYear;
        const fullEndYear = endYear < 100 ? 2000 + endYear : endYear;

        return {
            startDate: `${fullStartYear}-04-01`,
            endDate: `${fullEndYear}-03-31`
        };
    }

    /**
     * Get current financial year
     */
    static getCurrentFinancialYear(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // 0-indexed

        if (month >= 4) {
            // Apr-Dec: FY is current year to next year
            return `${year}-${(year + 1) % 100}`;
        } else {
            // Jan-Mar: FY is previous year to current year
            return `${year - 1}-${year % 100}`;
        }
    }

    /**
     * Get list of recent financial years
     */
    static getFinancialYearOptions(count: number = 5): string[] {
        const currentFY = this.getCurrentFinancialYear();
        const [startYear] = currentFY.split('-').map(y => parseInt(y));

        const options: string[] = [];
        for (let i = 0; i < count; i++) {
            const year = startYear - i;
            options.push(`${year}-${(year + 1) % 100}`);
        }

        return options;
    }

    /**
     * Export TDS summary to Excel
     */
    static exportTDSSummaryToExcel(
        clientSummaries: ClientTDSSummary[],
        transactions: TDSTransaction[],
        filename: string = 'TDS_Summary'
    ): void {
        // Create workbook
        const wb = XLSX.utils.book_new();

        // Sheet 1: Client-wise Summary
        const summaryData = clientSummaries.map(s => ({
            'Client Name': s.clientName,
            'Total Gross Amount': s.totalGrossAmount,
            'Total TDS Deducted': s.totalTDSAmount,
            'Average TDS Rate (%)': s.averageTDSRate.toFixed(2),
            'Number of Transactions': s.transactionCount,
            'Last TDS Date': s.lastTDSDate
        }));

        // Add totals row
        const totalGross = clientSummaries.reduce((sum, s) => sum + s.totalGrossAmount, 0);
        const totalTDS = clientSummaries.reduce((sum, s) => sum + s.totalTDSAmount, 0);
        const totalTransactions = clientSummaries.reduce((sum, s) => sum + s.transactionCount, 0);

        summaryData.push({
            'Client Name': 'TOTAL',
            'Total Gross Amount': totalGross,
            'Total TDS Deducted': totalTDS,
            'Average TDS Rate (%)': totalGross > 0 ? ((totalTDS / totalGross) * 100).toFixed(2) : '0.00',
            'Number of Transactions': totalTransactions,
            'Last TDS Date': ''
        });

        const ws1 = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, ws1, 'Client Summary');

        // Sheet 2: Detailed Transactions
        const transactionData = transactions.map(t => ({
            'Date': t.date,
            'Client Name': t.clientName,
            'Payment Reference': t.paymentReference,
            'Invoice Reference': t.invoiceReference || '-',
            'Gross Amount': t.grossAmount,
            'TDS Rate (%)': t.tdsRate,
            'TDS Amount': t.tdsAmount,
            'Net Amount Received': t.netAmount
        }));

        const ws2 = XLSX.utils.json_to_sheet(transactionData);
        XLSX.utils.book_append_sheet(wb, ws2, 'Detailed Transactions');

        // Download file
        XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    /**
     * Filter payment by date range
     */
    private static filterByDateRange(payment: Payment, filters?: DateRange): boolean {
        if (!filters) return true;

        const paymentDate = new Date(payment.tdsDate || payment.date);

        if (filters.startDate) {
            const startDate = new Date(filters.startDate);
            if (paymentDate < startDate) return false;
        }

        if (filters.endDate) {
            const endDate = new Date(filters.endDate);
            if (paymentDate > endDate) return false;
        }

        return true;
    }

    /**
     * Format currency for display
     */
    static formatCurrency(amount: number): string {
        return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    /**
     * Format date for display
     */
    static formatDate(date: string): string {
        return new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
}
