import React from 'react';
import { TransactionHistory } from '../TransactionHistory';
import { useAppData } from '../../hooks/useAppData';
import { useCustomers } from '../../hooks/useCustomers';

export const TransactionHistoryWrapper: React.FC = () => {
  const { payments, invoices, truckHiringNotes } = useAppData();
  const { customers } = useCustomers();

  const handleBack = () => {
    window.history.back();
  };

  return (
    <TransactionHistory
      customers={customers || []}
      payments={payments || []}
      invoices={invoices || []}
      truckHiringNotes={truckHiringNotes || []}
      onBack={handleBack}
    />
  );
};
