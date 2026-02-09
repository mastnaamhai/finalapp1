import React, { useState, useMemo } from 'react';
import { Card } from '../ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { format } from 'date-fns';
import { formatCurrency } from '../../lib/utils';
import { BrokerOutstandingEntry, BrokerOutstandingFilters } from '../../types/broker';
import { TruckHiringNote, Payment } from '../../types';

interface BrokerOutstandingProps {
  thns?: TruckHiringNote[];
  payments?: Payment[];
  filters?: BrokerOutstandingFilters;
  onFilterChange?: (filters: BrokerOutstandingFilters) => void;
  onExport?: (format: 'pdf' | 'excel' | 'csv') => void;
}

export const BrokerOutstanding: React.FC<BrokerOutstandingProps> = ({
  thns = [],
  payments = [],
  filters: initialFilters = {},
  onFilterChange,
  onExport
}) => {
  const [expandedBroker, setExpandedBroker] = useState<string | null>(null);
  const [filters, setFilters] = useState<BrokerOutstandingFilters>({
    sortBy: 'brokerName',
    sortOrder: 'asc',
    ...initialFilters
  });

  // Calculate broker outstanding from real THN data
  const brokers = useMemo(() => {
    // Group THNs by broker
    const brokerMap = new Map<string, BrokerOutstandingEntry>();

    thns.forEach(thn => {
      if (!thn.agencyName) return;

      const brokerId = thn.agencyName; // Use agency name as ID since there's no broker ID
      const brokerName = thn.agencyName;
      const contactNumber = thn.brokerContact || '';

      if (!brokerMap.has(brokerId)) {
        brokerMap.set(brokerId, {
          brokerId,
          brokerName,
          contactNumber,
          totalOutstanding: 0,
          lastPaymentDate: undefined,
          pendingTHNs: [],
          recentPayments: []
        });
      }

      const brokerEntry = brokerMap.get(brokerId)!;

      // Only include THNs with outstanding balance
      if (thn.balanceAmount > 0) {
        brokerEntry.totalOutstanding += thn.balanceAmount;
        brokerEntry.pendingTHNs.push({
          thnId: thn._id,
          thnNumber: thn.thnNumber,
          date: thn.date,
          amount: thn.freightRate + (thn.additionalCharges || 0),
          paidAmount: thn.paidAmount || 0,
          balanceAmount: thn.balanceAmount,
          status: thn.balanceAmount === 0 ? 'Partially Paid' :
            (thn.paidAmount || 0) > 0 ? 'Partially Paid' : 'Unpaid'
        });
      }

      // Add recent payments for this broker's THNs
      if (thn.payments && thn.payments.length > 0) {
        thn.payments.forEach(payment => {
          const paymentData = typeof payment === 'string' ?
            payments.find(p => p._id === payment) : payment;

          if (paymentData) {
            brokerEntry.recentPayments.push({
              date: paymentData.date,
              amount: paymentData.amount,
              thnNumber: thn.thnNumber,
              paymentMode: paymentData.mode
            });

            // Update last payment date
            const paymentDate = new Date(paymentData.date);
            if (!brokerEntry.lastPaymentDate ||
              new Date(brokerEntry.lastPaymentDate) < paymentDate) {
              brokerEntry.lastPaymentDate = paymentData.date;
            }
          }
        });
      }
    });

    // Convert map to array and sort recent payments
    return Array.from(brokerMap.values()).map(broker => ({
      ...broker,
      recentPayments: broker.recentPayments
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5) // Keep only 5 most recent
    }));
  }, [thns, payments]);

  const handleSort = (sortBy: BrokerOutstandingFilters['sortBy']) => {
    const newFilters = { ...filters };
    if (newFilters.sortBy === sortBy) {
      newFilters.sortOrder = newFilters.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      newFilters.sortBy = sortBy;
      newFilters.sortOrder = 'asc';
    }
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const toggleBrokerExpand = (brokerId: string) => {
    setExpandedBroker(expandedBroker === brokerId ? null : brokerId);
  };

  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    onExport?.(format);
  };



  if (brokers.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <p className="text-gray-500">No outstanding broker records found.</p>
        </div>
      </Card>
    );
  }

  // Calculate summary
  const totalOutstanding = brokers.reduce((sum, broker) => sum + broker.totalOutstanding, 0);
  const totalBrokers = brokers.length;
  const totalPendingTHNs = brokers.reduce((sum, broker) => sum + broker.pendingTHNs.length, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm font-medium text-gray-500">Total Brokers</p>
          <p className="text-2xl font-semibold">{totalBrokers}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-gray-500">Total Outstanding</p>
          <p className="text-2xl font-semibold">{formatCurrency(totalOutstanding)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-gray-500">Pending THNs</p>
          <p className="text-2xl font-semibold">{totalPendingTHNs}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Broker Name</label>
            <Input
              placeholder="Search by broker name"
              value={filters.brokerName || ''}
              onChange={(e) => setFilters({ ...filters, brokerName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min. Outstanding</label>
            <Input
              type="number"
              placeholder="Min amount"
              value={filters.minOutstanding || ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  minOutstanding: e.target.value ? Number(e.target.value) : undefined
                })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <Select
              value={filters.sortBy}
              onChange={(e) => handleSort(e.target.value as BrokerOutstandingFilters['sortBy'])}
              className="w-full"
              options={[
                { value: 'brokerName', label: 'Broker Name' },
                { value: 'totalOutstanding', label: 'Outstanding Amount' },
                { value: 'lastPaymentDate', label: 'Last Payment Date' }
              ]}
            />
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => handleExport('pdf')}
              className="w-full md:w-auto"
            >
              Export PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('excel')}
              className="w-full md:w-auto"
            >
              Export Excel
            </Button>
          </div>
        </div>
      </Card>

      {/* Brokers Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Broker Name</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Pending THNs</TableHead>
              <TableHead>Last Payment</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brokers.map((broker) => (
              <React.Fragment key={broker.brokerId}>
                <TableRow
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleBrokerExpand(broker.brokerId)}
                >
                  <TableCell>
                    <div className="font-medium">{broker.brokerName}</div>
                    {broker.contactNumber && (
                      <div className="text-sm text-gray-500">{broker.contactNumber}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(broker.totalOutstanding)}
                  </TableCell>
                  <TableCell>{broker.pendingTHNs.length} THNs</TableCell>
                  <TableCell>
                    {broker.lastPaymentDate
                      ? format(new Date(broker.lastPaymentDate), 'dd MMM yyyy')
                      : 'No payments'}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      className="text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBrokerExpand(broker.brokerId);
                      }}
                    >
                      {expandedBroker === broker.brokerId ? 'Hide' : 'View'} Details
                    </button>
                  </TableCell>
                </TableRow>
                {expandedBroker === broker.brokerId && (
                  <TableRow className="bg-gray-50">
                    <TableCell colSpan={5} className="p-0">
                      <div className="p-4">
                        <h4 className="font-medium mb-3">Pending THNs</h4>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>THN #</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Paid</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {broker.pendingTHNs.map((thn) => (
                                <TableRow key={thn.thnId}>
                                  <TableCell>{thn.thnNumber}</TableCell>
                                  <TableCell>
                                    {format(new Date(thn.date), 'dd MMM yyyy')}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(thn.amount)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(thn.paidAmount)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(thn.balanceAmount)}
                                  </TableCell>
                                  <TableCell>
                                    <span
                                      className={`px-2 py-1 text-xs rounded-full ${thn.status === 'Partially Paid'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                        }`}
                                    >
                                      {thn.status}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {broker.recentPayments.length > 0 && (
                          <div className="mt-6">
                            <h4 className="font-medium mb-3">Recent Payments</h4>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>THN #</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Mode</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {broker.recentPayments.map((payment, index) => (
                                    <TableRow key={index}>
                                      <TableCell>
                                        {format(new Date(payment.date), 'dd MMM yyyy')}
                                      </TableCell>
                                      <TableCell>{payment.thnNumber}</TableCell>
                                      <TableCell className="text-right">
                                        {formatCurrency(payment.amount)}
                                      </TableCell>
                                      <TableCell>{payment.paymentMode}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default BrokerOutstanding;