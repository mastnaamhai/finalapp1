import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { THNPdf } from '../THNPdf';
import { getTruckHiringNoteById } from '../../services/truckHiringNoteService';
import type { TruckHiringNote } from '../../types';

export const THNPdfWrapper: React.FC = () => {
  const context = useOutletContext<any>();
  const { id } = useParams();
  const [thn, setThn] = useState<TruckHiringNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchThn = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const fetchedThn = await getTruckHiringNoteById(id);
      console.log('THNPdfWrapper - Fetched THN:', fetchedThn);
      console.log('THNPdfWrapper - podDate:', fetchedThn?.podDate);
      console.log('THNPdfWrapper - expectedDeliveryDate:', fetchedThn?.expectedDeliveryDate);
      setThn(fetchedThn);
    } catch (err) {
      console.error('Failed to fetch THN:', err);
      setError('Failed to load Truck Hiring Note');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchThn();
  }, [fetchThn]);

  // Refetch data when the page becomes visible (e.g., after editing and coming back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && id) {
        console.log('Page became visible, refetching THN data...');
        fetchThn();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchThn, id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading THN...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => context.navigate('/truck-hiring')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Back to THN List
          </button>
        </div>
      </div>
    );
  }

  if (!thn) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">THN not found</p>
          <button
            onClick={() => context.navigate('/truck-hiring')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Back to THN List
          </button>
        </div>
      </div>
    );
  }

  return (
    <THNPdf
      key={`${thn._id}-${thn.expectedDeliveryDate}-${thn.podDate}`}
      thn={thn}
      companyInfo={context.companyInfo}
      onBack={() => context.navigate('/truck-hiring')}
    />
  );
};
