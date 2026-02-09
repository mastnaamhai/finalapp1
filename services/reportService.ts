import { TruckHiringNote } from '../types';

export interface THNSummary {
  totalTHNs: number;
  totalFreightAmount: number;
  totalAdvance: number;
  totalBalance: number;
  statusCounts: {
    Pending: number;
    'In Transit': number;
    Delivered: number;
    Paid: number;
    Cancelled: number;
  };
}

export const ReportService = {
  async getTHNSummary(thns: TruckHiringNote[]): Promise<THNSummary> {
    const summary: THNSummary = {
      totalTHNs: thns.length,
      totalFreightAmount: 0,
      totalAdvance: 0,
      totalBalance: 0,
      statusCounts: {
        'Pending': 0,
        'In Transit': 0,
        'Delivered': 0,
        'Paid': 0,
        'Cancelled': 0
      }
    };

    thns.forEach(thn => {
      const freightAmount = thn.freightRate + (thn.additionalCharges || 0);
      const balance = thn.balanceAmount;
      const advance = thn.advanceAmount;

      summary.totalFreightAmount += freightAmount;
      summary.totalAdvance += advance;
      summary.totalBalance += balance;

      const status = thn.status || 'Pending';
      if (status in summary.statusCounts) {
        summary.statusCounts[status as keyof typeof summary.statusCounts]++;
      } else {
        summary.statusCounts.Pending++;
      }
    });

    return summary;
  }
};
