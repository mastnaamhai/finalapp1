import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Clients } from '../Clients';

export const ClientsWrapper: React.FC = () => {
  const context = useOutletContext<any>();

  return (
    <Clients
      customers={context.customers}
      payments={context.payments}
      invoices={context.invoices}
      onSave={context.saveCustomer}
      onDelete={context.handleDeleteCustomer}
      onSavePayment={context.savePayment}
      onBack={() => context.navigate('/dashboard')}
    />
  );
};



