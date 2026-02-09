import { Payment, TruckHiringNote } from '../types';

export interface BrokerOutstandingEntry {
  brokerId: string;
  brokerName: string;
  contactNumber?: string;
  totalOutstanding: number;
  lastPaymentDate?: string;
  pendingTHNs: {
    thnId: string;
    thnNumber: number;
    date: string;
    amount: number;
    paidAmount: number;
    balanceAmount: number;
    status: 'Unpaid' | 'Partially Paid';
  }[];
  recentPayments: {
    date: string;
    amount: number;
    thnNumber: number;
    paymentMode: string;
  }[];
}

export interface BrokerOutstandingFilters {
  brokerName?: string;
  minOutstanding?: number;
  maxOutstanding?: number;
  sortBy?: 'brokerName' | 'totalOutstanding' | 'lastPaymentDate';
  sortOrder?: 'asc' | 'desc';
}

export interface BrokerPayment {
  _id: string;
  brokerId: string;
  brokerName: string;
  date: string;
  amount: number;
  paymentMode: string;
  referenceNumber?: string;
  notes?: string;
  thnReferences: {
    thnId: string;
    thnNumber: number;
    amount: number;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface BrokerSummary {
  totalBrokers: number;
  totalOutstanding: number;
  totalPendingTHNs: number;
  brokers: Array<{
    brokerId: string;
    brokerName: string;
    outstandingAmount: number;
    pendingTHNCount: number;
  }>;
}
