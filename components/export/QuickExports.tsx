import React, { useState } from 'react';
import type { LorryReceipt, Invoice, Payment, Customer, TruckHiringNote } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { exportToCsv } from '../../services/exportService';
import { formatDate } from '../../services/utils';

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV', description: 'Comma-separated values' },
  { value: 'json', label: 'JSON', description: 'JavaScript Object Notation' }
];

interface QuickExportsProps {
  lorryReceipts: LorryReceipt[];
  invoices: Invoice[];
  payments: Payment[];
  customers: Customer[];
  truckHiringNotes: TruckHiringNote[];
}

export const QuickExports = (props: QuickExportsProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('csv');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Helper function to filter data by date range
  const filterDataByDateRange = <T extends { date: string }>(data: T[]): T[] => {
    if (!dateRange.start && !dateRange.end) {
      return data; // No filtering if no dates selected
    }

    return data.filter(item => {
      const itemDate = new Date(item.date);
      const startDate = dateRange.start ? new Date(dateRange.start) : null;
      const endDate = dateRange.end ? new Date(dateRange.end) : null;

      // Set time to start/end of day for inclusive filtering
      if (startDate) startDate.setHours(0, 0, 0, 0);
      if (endDate) endDate.setHours(23, 59, 59, 999);

      if (startDate && endDate) {
        return itemDate >= startDate && itemDate <= endDate;
      } else if (startDate) {
        return itemDate >= startDate;
      } else if (endDate) {
        return itemDate <= endDate;
      }

      return true;
    });
  };
  const handleExportLrs = () => {
    const filteredData = filterDataByDateRange(props.lorryReceipts);
    const data = filteredData.map(lr => ({
      'LR No': lr.lrNumber,
      'Date': formatDate(lr.date),
      'Consignor': lr.consignor?.name || '',
      'Consignee': lr.consignee?.name || '',
      'Vehicle No': lr.vehicleNumber,
      'From': lr.from,
      'To': lr.to,
      'Amount': lr.totalAmount,
      'Status': lr.status
    }));
    exportToCsv('lorry-receipts', data);
  };

  const handleExportInvoices = () => {
    const filteredData = filterDataByDateRange(props.invoices);
    const data = filteredData.map(inv => ({
      'Invoice No': inv.invoiceNumber,
      'Date': formatDate(inv.date),
      'Customer': inv.customer?.name || '',
      'Amount': inv.totalAmount,
      'GST Type': inv.gstType,
      'CGST': inv.cgstAmount,
      'SGST': inv.sgstAmount,
      'IGST': inv.igstAmount,
      'Grand Total': inv.grandTotal,
      'Status': inv.status
    }));
    exportToCsv('invoices', data);
  };

  const handleExportTHNs = () => {
    const filteredData = filterDataByDateRange(props.truckHiringNotes);
    const data = filteredData.map(thn => ({
      'THN No': thn.thnNumber,
      'Date': formatDate(thn.date),
      'Truck No': thn.truckNumber,
      'From': thn.loadingLocation,
      'To': thn.unloadingLocation,
      'Freight Rate': thn.freightRate,
      'Total Amount': thn.paidAmount + thn.balanceAmount,
      'Status': thn.status
    }));
    exportToCsv('truck-hiring-notes', data);
  };

  const handleExportCustomers = () => {
    const data = props.customers.map(customer => ({
      'Name': customer.name,
      'Trade Name': customer.tradeName || '',
      'Address': customer.address,
      'State': customer.state,
      'GSTIN': customer.gstin || '',
      'Contact Person': customer.contactPerson || '',
      'Phone': customer.contactPhone || customer.phone || '',
      'Email': customer.contactEmail || customer.email || ''
    }));
    exportToCsv('customers', data);
  };

  const handleExportPayments = () => {
    const filteredData = filterDataByDateRange(props.payments);
    const data = filteredData.map(payment => ({
      'Date': formatDate(payment.date),
      'Amount': payment.amount,
      'Mode': payment.mode,
      'Type': payment.type,
      'Reference': payment.referenceNo || '',
      'Notes': payment.notes || ''
    }));
    exportToCsv('payments', data);
  };

  const handleExportAllData = () => {
    const allData = {
      customers: props.customers,
      lorryReceipts: props.lorryReceipts,
      invoices: props.invoices,
      truckHiringNotes: props.truckHiringNotes,
      payments: props.payments,
      exportInfo: {
        exportedAt: new Date().toISOString(),
        totalRecords: props.customers.length + props.lorryReceipts.length + props.invoices.length + props.truckHiringNotes.length + props.payments.length,
        dateRange: {
          start: getEarliestDate(),
          end: getLatestDate()
        }
      }
    };
    
    const dataStr = JSON.stringify(allData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    
    const dateRange = getDateRangeString();
    link.download = `complete-data-backup-${dateRange}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getEarliestDate = () => {
    const allDates = [
      ...props.lorryReceipts.map(lr => lr.date),
      ...props.invoices.map(inv => inv.date),
      ...props.truckHiringNotes.map(thn => thn.date),
      ...props.payments.map(pay => pay.date)
    ].filter(Boolean);
    
    if (allDates.length === 0) return new Date().toISOString().split('T')[0];
    return new Date(Math.min(...allDates.map(d => new Date(d).getTime()))).toISOString().split('T')[0];
  };

  const getLatestDate = () => {
    const allDates = [
      ...props.lorryReceipts.map(lr => lr.date),
      ...props.invoices.map(inv => inv.date),
      ...props.truckHiringNotes.map(thn => thn.date),
      ...props.payments.map(pay => pay.date)
    ].filter(Boolean);
    
    if (allDates.length === 0) return new Date().toISOString().split('T')[0];
    return new Date(Math.max(...allDates.map(d => new Date(d).getTime()))).toISOString().split('T')[0];
  };

  const getDateRangeString = () => {
    const start = getEarliestDate();
    const end = getLatestDate();
    return start === end ? start : `${start}-to-${end}`;
  };

  // Calculate filtered counts for display
  const lrCount = dateRange.start || dateRange.end ? filterDataByDateRange(props.lorryReceipts).length : props.lorryReceipts.length;
  const invoiceCount = dateRange.start || dateRange.end ? filterDataByDateRange(props.invoices).length : props.invoices.length;
  const thnCount = dateRange.start || dateRange.end ? filterDataByDateRange(props.truckHiringNotes).length : props.truckHiringNotes.length;
  const customerCount = props.customers.length; // Customers don't have dates, so no filtering
  const paymentCount = dateRange.start || dateRange.end ? filterDataByDateRange(props.payments).length : props.payments.length;

  const exportButtons = [
    {
      label: 'Lorry Receipts',
      count: lrCount,
      onClick: handleExportLrs,
      description: 'Export all lorry receipts to CSV',
      color: 'blue'
    },
    {
      label: 'Invoices',
      count: invoiceCount,
      onClick: handleExportInvoices,
      description: 'Export all invoices with GST details to CSV',
      color: 'green'
    },
    {
      label: 'Truck Hiring Notes',
      count: thnCount,
      onClick: handleExportTHNs,
      description: 'Export all truck hiring notes to CSV',
      color: 'purple'
    },
    {
      label: 'Customers',
      count: customerCount,
      onClick: handleExportCustomers,
      description: 'Export all customer details to CSV',
      color: 'orange'
    },
    {
      label: 'Payments',
      count: paymentCount,
      onClick: handleExportPayments,
      description: 'Export all payment records to CSV',
      color: 'red'
    },
    {
      label: 'Complete Data',
      count: props.lorryReceipts.length + props.invoices.length + props.truckHiringNotes.length + props.customers.length + props.payments.length,
      onClick: handleExportAllData,
      description: 'Export all data as JSON backup',
      color: 'indigo'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-800">Quick Exports</h3>
        <p className="text-gray-600 mt-1">One-click exports for your most common data needs</p>

        {/* Date Range Filters */}
        <div className="mt-4 bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-blue-800">Filter by Date Range (Optional):</span>
            </div>
            <div className="flex space-x-2">
              <div>
                <label className="block text-xs text-blue-700 mb-1">From</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="px-3 py-1 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-blue-700 mb-1">To</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="px-3 py-1 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exportButtons.map((button, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-800">{button.label}</h4>
                <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${button.color}-100 text-${button.color}-800`}>
                  {button.count} records
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">{button.description}</p>
              
              <Button
                onClick={button.onClick}
                variant="secondary"
                className="w-full"
                disabled={button.count === 0}
              >
                {button.count === 0 ? 'No data to export' : `Export ${button.label}`}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Advanced Options */}
      <Card className="border-gray-300">
        <div className="p-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h3 className="text-lg font-medium text-gray-800">Advanced Options</h3>
              <p className="text-sm text-gray-600">Choose export format</p>
            </div>
            <svg
              className={`h-5 w-5 text-gray-500 transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAdvanced && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Export Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {EXPORT_FORMATS.map(format => (
                    <label key={format.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="format"
                        value={format.value}
                        checked={selectedFormat === format.value}
                        onChange={(e) => setSelectedFormat(e.target.value)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">{format.label}</span>
                        <p className="text-xs text-gray-500">{format.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
