import { API_BASE_URL } from '../constants';
import type { Invoice } from '../types';


export const getInvoices = async (params?: { page?: number; limit?: number }): Promise<Invoice[]> => {
    // Build query string
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    // Default to high limit if not specified to fetch all by default for now, 
    // or respect the passed limit.
    if (!params?.limit) queryParams.append('limit', '1000');

    const response = await fetch(`${API_BASE_URL}/invoices?${queryParams.toString()}`);
    if (!response.ok) {
        throw new Error('Failed to fetch invoices');
    }
    const data = await response.json();
    // Handle both paginated and direct array responses
    return Array.isArray(data) ? data : (data.items || []);
};

export const createInvoice = async (invoice: Omit<Invoice, 'id' | '_id'>): Promise<Invoice> => {
    const response = await fetch(`${API_BASE_URL}/invoices`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoice),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
        const details = (errorData?.errors?.fieldErrors) ?
            Object.entries(errorData.errors.fieldErrors)
                .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
                .join(' | ') : undefined;
        const composed = [errorData?.message, details].filter(Boolean).join(' - ');
        const err = new Error(composed || 'Failed to create invoice');
        (err as any).fieldErrors = errorData?.errors?.fieldErrors;
        throw err;
    }
    return response.json();
};

export const updateInvoice = async (id: string, invoice: Partial<Invoice>): Promise<Invoice> => {
    // Transform frontend data format to backend format
    const backendData = { ...invoice };

    if (invoice.customerId) {
        (backendData as any).customer = invoice.customerId;
        delete (backendData as any).customerId;
    }

    const response = await fetch(`${API_BASE_URL}/invoices/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(backendData),
    });
    if (!response.ok) {
        throw new Error('Failed to update invoice');
    }
    return response.json();
};

export const deleteInvoice = async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/invoices/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete invoice');
    }
};
