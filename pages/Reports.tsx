import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { Card } from '../components/ui/Card';
import { PageContainer } from '../components/ui/PageContainer';
import { PageHeader } from '../components/ui/PageHeader';
import { THNSummary } from '../components/reports/THNSummary';
import { PaymentSummary } from '../components/reports/PaymentSummary';
import { BrokerOutstanding } from '../components/reports/BrokerOutstanding';
import { TDSSummary } from '../components/reports/TDSSummary';
import { TruckHiringNote, Payment, Customer, Invoice } from '../types';

interface ReportsProps {
  truckHiringNotes: TruckHiringNote[];
  payments?: Payment[];
  customers?: Customer[];
  invoices?: Invoice[];
  loadingPayments?: boolean;
  onExportBrokerOutstanding?: (format: string) => void;
  onBrokerFilterChange?: (filters: any) => void;
  onSavePayment?: (payment: any) => Promise<void>;
}

export const Reports: React.FC<ReportsProps> = ({
  truckHiringNotes = [],
  payments = [],
  customers = [],
  invoices = [],
  loadingPayments = false,
  onExportBrokerOutstanding,
  onBrokerFilterChange,
  onSavePayment
}) => {
  const [activeTab, setActiveTab] = useState('thn-summary');

  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        subtitle="Financial insights and transaction summaries"
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="thn-summary">THN Summary</TabsTrigger>
          <TabsTrigger value="payment-summary">Payments</TabsTrigger>
          <TabsTrigger value="broker-outstanding">Broker Outstanding</TabsTrigger>
          <TabsTrigger value="tds-summary">TDS Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="thn-summary">
          <Card>
            <THNSummary thns={truckHiringNotes} />
          </Card>
        </TabsContent>

        <TabsContent value="payment-summary">
          <PaymentSummary
            payments={payments}
            isLoading={loadingPayments}
          />
        </TabsContent>

        <TabsContent value="broker-outstanding">
          <BrokerOutstanding
            thns={truckHiringNotes}
            payments={payments}
            onExport={onExportBrokerOutstanding}
            onFilterChange={onBrokerFilterChange}
          />
        </TabsContent>

        <TabsContent value="tds-summary">
          <TDSSummary
            payments={payments}
            customers={customers}
            invoices={invoices}
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
};
