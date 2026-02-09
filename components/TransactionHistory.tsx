import React, { useState, useMemo } from 'react';
import type { Payment, Invoice, TruckHiringNote, Customer } from '../types';
import { formatDate } from '../services/utils';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { UniversalSearchSort, SortOption } from './ui/UniversalSearchSort';
import { Pagination } from './ui/Pagination';

import { PageContainer } from './ui/PageContainer';
import { PageHeader } from './ui/PageHeader';

interface TransactionHistoryProps {
  payments: Payment[];
  invoices: Invoice[];
  truckHiringNotes: TruckHiringNote[];
  customers: Customer[];
  onBack: () => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  payments,
  invoices,
  truckHiringNotes,
  customers,
  onBack
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const sortOptions: SortOption[] = [
    { value: 'date', label: 'Sort by Date' },
    { value: 'amount', label: 'Sort by Amount' },
    { value: 'customer', label: 'Sort by Customer' },
    { value: 'type', label: 'Sort by Type' },
    { value: 'mode', label: 'Sort by Payment Mode' },
    { value: 'documentNumber', label: 'Sort by Document Number' }
  ];

  // Enrich payments with related document and customer info
  const enrichedPayments = useMemo(() => {
    return payments.map(payment => {
      let documentType = '';
      let documentNumber = '';

      // Find related invoice
      if (payment.invoiceId) {
        const paymentInvoiceId = typeof payment.invoiceId === 'string'
          ? payment.invoiceId
          : (payment.invoiceId as any)._id;

        const document = invoices.find(inv => inv._id === paymentInvoiceId);
        if (document) {
          documentType = 'Invoice';
          documentNumber = document.invoiceNumber.toString();
        }
      }

      // Find related THN
      if (payment.truckHiringNoteId && !documentType) {
        const paymentThnId = typeof payment.truckHiringNoteId === 'string'
          ? payment.truckHiringNoteId
          : (payment.truckHiringNoteId as any)._id;

        const document = truckHiringNotes.find(thn => thn._id === paymentThnId);
        if (document) {
          documentType = 'THN';
          documentNumber = document.thnNumber.toString();
        }
      }

      // Find customer name from payment.customerId
      const customer = customers.find(c => c._id === payment.customerId);

      return {
        ...payment,
        documentType,
        documentNumber,
        customerName: customer?.name || payment.customer?.name || 'Unknown'
      };
    });
  }, [payments, invoices, truckHiringNotes, customers]);

  // Filter and sort payments
  const filteredPayments = useMemo(() => {
    let filtered = enrichedPayments;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(payment =>
        payment.customerName.toLowerCase().includes(searchLower) ||
        payment.documentNumber.toLowerCase().includes(searchLower) ||
        payment.documentType.toLowerCase().includes(searchLower) ||
        payment.type.toLowerCase().includes(searchLower) ||
        payment.mode.toLowerCase().includes(searchLower) ||
        (payment.referenceNo || '').toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = '';
      let bValue: any = '';

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'customer':
          aValue = a.customerName.toLowerCase();
          bValue = b.customerName.toLowerCase();
          break;
        case 'type':
          aValue = a.type.toLowerCase();
          bValue = b.type.toLowerCase();
          break;
        case 'mode':
          aValue = a.mode.toLowerCase();
          bValue = b.mode.toLowerCase();
          break;
        case 'documentNumber':
          aValue = a.documentNumber;
          bValue = b.documentNumber;
          break;
        default:
          aValue = new Date(a.date);
          bValue = new Date(b.date);
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [enrichedPayments, searchTerm, sortBy, sortOrder]);

  // Paginated payments
  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPayments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPayments, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);

  // Reset to first page when search or sort changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy, sortOrder]);

  const handleClearSearch = () => {
    setSearchTerm('');
    setCurrentPage(1);
  };

  const totalAmount = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalPayments = payments.length;
  const filteredPaymentsCount = filteredPayments.length;

  return (
    <PageContainer>
      <PageHeader
        title="Transaction History"
        actions={<Button variant="secondary" onClick={onBack}>Back</Button>}
      />

      <Card>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-blue-600">Total Transactions</h3>
            <p className="text-2xl font-bold text-blue-800">{totalPayments}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-green-600">
              {searchTerm ? 'Filtered Amount' : 'Total Amount'}
            </h3>
            <p className="text-2xl font-bold text-green-800">
              ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-purple-600">Showing</h3>
            <p className="text-2xl font-bold text-purple-800">
              {filteredPaymentsCount} {searchTerm ? 'filtered' : ''} transaction{filteredPaymentsCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <UniversalSearchSort
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search by customer, document number, type, mode, or reference..."
          sortBy={sortBy}
          onSortChange={setSortBy}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          sortOptions={sortOptions}
          totalItems={totalPayments}
          filteredItems={filteredPaymentsCount}
          onClearSearch={handleClearSearch}
        />
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedPayments.map((payment) => (
                <tr key={payment._id} className="hover:bg-slate-50 transition-colors duration-200">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(payment.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.customerName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      <span className="font-medium">{payment.documentType}</span>
                      {payment.documentNumber && (
                        <span className="ml-1">#{payment.documentNumber}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${payment.type === 'Advance' ? 'bg-blue-100 text-blue-800' :
                      payment.type === 'Payment' ? 'bg-green-100 text-green-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                      {payment.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-center text-gray-900">
                    ₹{payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${payment.mode === 'Cash' ? 'bg-gray-100 text-gray-800' :
                      payment.mode === 'UPI' ? 'bg-purple-100 text-purple-800' :
                        payment.mode === 'NEFT' || payment.mode === 'RTGS' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                      }`}>
                      {payment.mode}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {payment.referenceNo || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                    <div className="truncate" title={payment.notes || ''}>
                      {payment.notes || '-'}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedPayments.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    {searchTerm ? (
                      <div>
                        <p>No transactions found matching "{searchTerm}"</p>
                        <Button
                          variant="link"
                          onClick={handleClearSearch}
                          className="mt-2 text-sm"
                        >
                          Clear search to see all transactions
                        </Button>
                      </div>
                    ) : (
                      "No transactions found."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredPaymentsCount}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      </Card>
    </PageContainer>
  );
};
