import React from 'react';
import { Payment } from '../../types';
import { Card } from '../ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { format } from 'date-fns';
import { formatCurrency } from '../../lib/utils';

interface PaymentSummaryProps {
  payments: Payment[];
  isLoading?: boolean;
}

export const PaymentSummary: React.FC<PaymentSummaryProps> = ({ payments, isLoading = false }) => {
  // Filter to show only THN-related payments
  const thnPayments = payments.filter(payment => payment.truckHiringNoteId);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading payments...</p>
        </div>
      </Card>
    );
  }

  if (thnPayments.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <p className="text-gray-500">No THN payment records found.</p>
        </div>
      </Card>
    );
  }

  // Calculate summary for THN payments only
  const totalPayments = thnPayments.length;
  const totalAmount = thnPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const settledAmount = thnPayments
    .filter(p => p.unsettledAmount !== undefined && p.unsettledAmount < p.amount)
    .reduce((sum, p) => sum + (p.amount - (p.unsettledAmount || 0)), 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm font-medium text-gray-500">Total Payments</p>
          <p className="text-2xl font-semibold">{totalPayments}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-gray-500">Total Amount</p>
          <p className="text-2xl font-semibold">{formatCurrency(totalAmount)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-gray-500">Settled Amount</p>
          <p className="text-2xl font-semibold text-green-600">{formatCurrency(settledAmount)}</p>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>THN Number</TableHead>
                <TableHead>Reference No</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mode</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {thnPayments.map((payment) => (
                <TableRow key={payment._id}>
                  <TableCell>{format(new Date(payment.date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    {payment.truckHiringNote && typeof payment.truckHiringNote === 'object'
                      ? payment.truckHiringNote.thnNumber
                      : 'N/A'}
                  </TableCell>
                  <TableCell>{payment.referenceNo || 'N/A'}</TableCell>
                  <TableCell>{payment.type}</TableCell>
                  <TableCell>{formatCurrency(payment.amount)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs rounded-full ${payment.unsettledAmount && payment.unsettledAmount > 0
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                      }`}>
                      {payment.unsettledAmount && payment.unsettledAmount > 0 ? 'Pending' : 'Settled'}
                    </span>
                  </TableCell>
                  <TableCell>{payment.mode}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
