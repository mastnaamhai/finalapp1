import React, { useEffect, useState } from 'react';
import { TruckHiringNote } from '../../types';
import { ReportService, THNSummary as THNSummaryType } from '../../services/reportService';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { formatCurrency } from '../../services/utils';

interface THNSummaryProps {
  thns: TruckHiringNote[];
}

export const THNSummary: React.FC<THNSummaryProps> = ({ thns }) => {
  const [summary, setSummary] = useState<THNSummaryType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setLoading(true);
        const data = await ReportService.getTHNSummary(thns);
        setSummary(data);
      } catch (err) {
        console.error('Failed to load THN summary:', err);
        setError('Failed to load summary data');
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [thns]);

  if (loading) return <div className="text-center py-8">Loading summary...</div>;
  if (error) return <div className="text-center text-red-500 py-8">{error}</div>;
  if (!summary) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard 
          title="Total THNs" 
          value={summary.totalTHNs.toString()} 
          description="Total truck hiring notes"
        />
        <SummaryCard 
          title="Total Freight" 
          value={formatCurrency(summary.totalFreightAmount)}
          description="Total freight amount"
        />
        <SummaryCard 
          title="Total Advance" 
          value={formatCurrency(summary.totalAdvance)}
          description="Total advance received"
        />
        <SummaryCard 
          title="Balance Pending" 
          value={formatCurrency(summary.totalBalance)}
          description="Total pending amount"
          isBalance={true}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(summary.statusCounts).map(([status, count]) => (
              <div key={status} className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm text-gray-500">{status}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const SummaryCard: React.FC<{
  title: string;
  value: string;
  description: string;
  isBalance?: boolean;
}> = ({ title, value, description, isBalance = false }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className={`text-2xl font-bold ${isBalance ? 'text-red-600' : ''}`}>
        {value}
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </CardContent>
  </Card>
);
