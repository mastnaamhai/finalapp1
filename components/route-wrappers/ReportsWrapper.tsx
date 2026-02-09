import React, { useMemo } from 'react';
import { Reports } from '../../pages/Reports';
import { useAppData } from '../../hooks/useAppData';
import type { Customer } from '../../types';

export const ReportsWrapper: React.FC = () => {
  const { truckHiringNotes, payments, invoices, savePayment } = useAppData();

  // Extract unique customers from invoices and payments
  const customers = useMemo(() => {
    const customerMap = new Map<string, Customer>();

    // Get customers from invoices
    invoices.forEach(inv => {
      if (inv.customer && typeof inv.customer === 'object' && '_id' in inv.customer) {
        customerMap.set(inv.customer._id, inv.customer as Customer);
      }
    });

    // Get customers from payments
    payments.forEach(payment => {
      if (payment.customer && typeof payment.customer === 'object' && '_id' in payment.customer) {
        customerMap.set((payment.customer as any)._id, payment.customer as Customer);
      }
    });

    return Array.from(customerMap.values());
  }, [invoices, payments]);

  return <Reports
    truckHiringNotes={truckHiringNotes}
    payments={payments}
    customers={customers}
    invoices={invoices}
    onSavePayment={savePayment}
  />;
};
