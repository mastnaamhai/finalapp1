import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import type { Customer } from '../types';

interface ClientFormModalProps {
    client?: Customer;
    onSave: (client: Omit<Customer, '_id'> | Customer) => Promise<void>;
    onClose: () => void;
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({ client, onSave, onClose }) => {
    const [formData, setFormData] = useState<Partial<Customer>>({
        name: '',
        tradeName: '',
        gstin: '',
        email: '',
        phone: '',
        contactPerson: '',
        contactPhone: '',
        contactEmail: '',
        address: '',
        state: '',
        city: '',
        pin: '',
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (client) {
            setFormData(client);
        }
    }, [client]);

    const handleChange = (field: keyof Customer, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.state) return;

        setIsSaving(true);
        try {
            await onSave(formData as Customer);
            onClose();
        } catch (error) {
            console.error('Failed to save client:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">
                        {client ? 'Edit Client' : 'Add New Client'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <span className="sr-only">Close</span>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Business Name *"
                            value={formData.name || ''}
                            onChange={e => handleChange('name', e.target.value)}
                            required
                        />
                        <Input
                            label="Trade Name"
                            value={formData.tradeName || ''}
                            onChange={e => handleChange('tradeName', e.target.value)}
                        />
                        <Input
                            label="GSTIN"
                            value={formData.gstin || ''}
                            onChange={e => handleChange('gstin', e.target.value)}
                        />
                        <Input
                            label="State *"
                            value={formData.state || ''}
                            onChange={e => handleChange('state', e.target.value)}
                            required
                        />
                        <Input
                            label="City"
                            value={formData.city || ''}
                            onChange={e => handleChange('city', e.target.value)}
                        />
                        <Input
                            label="PIN Code"
                            value={formData.pin || ''}
                            onChange={e => handleChange('pin', e.target.value)}
                        />
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-700 border-b pb-2">Contact Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Contact Person"
                                value={formData.contactPerson || ''}
                                onChange={e => handleChange('contactPerson', e.target.value)}
                            />
                            <Input
                                label="Phone Number"
                                value={formData.phone || ''}
                                onChange={e => handleChange('phone', e.target.value)}
                            />
                            <Input
                                label="Email"
                                type="email"
                                value={formData.email || ''}
                                onChange={e => handleChange('email', e.target.value)}
                            />
                            <Input
                                label="Alternate Phone"
                                value={formData.contactPhone || ''}
                                onChange={e => handleChange('contactPhone', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Address</label>
                        <textarea
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            rows={3}
                            value={formData.address || ''}
                            onChange={e => handleChange('address', e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSaving}>
                            {client ? 'Update Client' : 'Add Client'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};
