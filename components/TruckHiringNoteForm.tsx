import { useState, useEffect, useRef } from 'react';
import type { TruckHiringNote, CompanyInfo } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ValidatedInput } from './ui/ValidatedInput';
import { ValidatedTextarea } from './ui/ValidatedTextarea';
import { AutocompleteInput } from './ui/AutocompleteInput';
import { VehicleNumberInput } from './ui/VehicleNumberInput';
import { getCurrentDate } from '../services/utils';
import { commonCities } from '../constants/formData';
import { useFormValidation } from '../hooks/useFormValidation';
import { fieldRules } from '../services/formValidation';
import { simpleNumberingService } from '../services/simpleNumberingService';

interface TruckHiringNoteFormProps {
    existingNote?: TruckHiringNote;
    companyInfo: CompanyInfo;
    onSave: (note: Partial<Omit<TruckHiringNote, '_id' | 'balanceAmount' | 'paidAmount' | 'payments' | 'status'>>) => Promise<any>;
    onCancel: () => void;
}

export const TruckHiringNoteForm = ({ existingNote, companyInfo, onSave, onCancel }: TruckHiringNoteFormProps) => {
    const getInitialState = (): Partial<Omit<TruckHiringNote, '_id' | 'balanceAmount' | 'paidAmount' | 'payments' | 'status'>> => ({
        thnNumber: 0, // Will be set by useEffect
        date: getCurrentDate(),
        truckNumber: '',
        vehicleCapacity: 0,
        loadingLocation: '',
        unloadingLocation: '',
        expectedDeliveryDate: '',
        agencyName: '',
        brokerContact: '',
        freightRate: 0,
        advanceAmount: 0,
        remarks: '',
        linkedLR: '',
        linkedInvoice: ''
    });

    const [note, setNote] = useState(existingNote || getInitialState());
    const [isSaving, setIsSaving] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    // Validation rules
    const validationRules = {
        date: fieldRules.date,
        truckNumber: fieldRules.vehicleNumber,
        vehicleCapacity: { required: true, min: 0, message: 'Weight is required' },
        agencyName: { required: true, minLength: 2, message: 'Broker Name is required' },
        freightRate: fieldRules.freightRate,
        advanceAmount: fieldRules.advanceAmount,
        thnNumber: { required: true, min: 1, message: 'THN Number is required' },
    };

    // Form validation hook
    const {
        errors,
        isValid,
        validateForm: validateEntireForm,
        setFieldError,
        clearFieldError,
        setErrors
    } = useFormValidation({
        validationRules,
        validateOnChange: true,
        validateOnBlur: true,
        validateOnSubmit: true
    });

    // Common cities for autocomplete
    const commonCitiesOptions = commonCities || [
        'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad',
        'Jaipur', 'Surat', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal',
        'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana',
        'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot', 'Kalyan-Dombivli', 'Vasai-Virar'
    ];

    useEffect(() => {
        if (existingNote) {
            setNote(existingNote);
        } else {
            // Load next THN number for new notes
            const loadNextThnNumber = async () => {
                try {
                    const nextNumber = await simpleNumberingService.getNextNumber('truckHiringNoteId');
                    setNote(prev => ({ ...prev, thnNumber: nextNumber }));
                } catch (error) {
                    console.error('Failed to load next THN number:', error);
                    // Keep the default 0 or show error
                }
            };
            loadNextThnNumber();
        }
    }, [existingNote]);

    // Validation function
    const validateForm = (): boolean => {
        const formErrors = validateEntireForm(note);
        setErrors(formErrors);
        return Object.keys(formErrors).length === 0;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        clearFieldError(name);

        setNote(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value,
        }));
    };

    const handleValueChange = (fieldName: string, value: any) => {
        clearFieldError(fieldName);
        setNote(prev => ({
            ...prev,
            [fieldName]: value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            const firstErrorField = Object.keys(errors)[0];
            if (firstErrorField) {
                const element = document.querySelector(`[name="${firstErrorField}"]`) as HTMLElement;
                element?.focus();
            }
            return;
        }

        console.log("Submitting THN data:", JSON.stringify(note, null, 2));
        setIsSaving(true);
        try {
            await onSave(note);
        } catch (error) {
            console.error("Failed to save Truck Hiring Note", error);
        } finally {
            setIsSaving(false);
        }
    };

    const balanceAmount = (note.freightRate || 0) - (note.advanceAmount || 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start p-4 overflow-y-auto" data-form-modal="true">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-4 sm:my-8 overflow-y-auto" onClick={e => e.stopPropagation()}>
                <form ref={formRef} onSubmit={handleSubmit}>
                    <Card title={existingNote ? `Edit Truck Hiring Note #${existingNote.thnNumber}` : 'Create New Truck Hiring Note'}>
                        <div className="space-y-6">

                            {/* THN Number Row */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Truck Hire No. <span className="text-red-500">*</span>
                                    </label>
                                    <ValidatedInput
                                        fieldName="thnNumber"
                                        validationRules={validationRules}
                                        value={note.thnNumber || ''}
                                        onValueChange={(value) => handleValueChange('thnNumber', value)}
                                        type="number"
                                        required
                                        min="1"
                                        placeholder="Auto-generated number"
                                    />
                                </div>
                            </div>

                            {/* Row 1: Date, Broker Name, Truck No */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Date <span className="text-red-500">*</span>
                                    </label>
                                    <ValidatedInput
                                        fieldName="date"
                                        validationRules={validationRules}
                                        value={note.date || ''}
                                        onValueChange={(value) => handleValueChange('date', value)}
                                        type="date"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Broker's Name <span className="text-red-500">*</span>
                                    </label>
                                    <ValidatedInput
                                        fieldName="agencyName"
                                        validationRules={validationRules}
                                        value={note.agencyName || ''}
                                        onValueChange={(value) => handleValueChange('agencyName', value)}
                                        placeholder="Enter Broker Name"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Truck No. <span className="text-red-500">*</span>
                                    </label>
                                    <VehicleNumberInput
                                        fieldName="truckNumber"
                                        value={note.truckNumber || ''}
                                        onChange={(value) => handleValueChange('truckNumber', value)}
                                        onValueChange={handleValueChange}
                                        required
                                        error={errors.truckNumber}
                                        placeholder="e.g., MH-12-AB-1234"
                                    />
                                </div>
                            </div>

                            {/* Row 2: From, To, Loading Point */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        From / Loading Point <span className="text-red-500">*</span>
                                    </label>
                                    <AutocompleteInput
                                        name="loadingLocation"
                                        value={typeof note.loadingLocation === 'string' ? note.loadingLocation : ''}
                                        onChange={handleChange}
                                        suggestions={commonCitiesOptions}
                                        placeholder="Enter Loading Location"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        To / Unloading Location <span className="text-red-500">*</span>
                                    </label>
                                    <AutocompleteInput
                                        name="unloadingLocation"
                                        value={typeof note.unloadingLocation === 'string' ? note.unloadingLocation : ''}
                                        onChange={handleChange}
                                        suggestions={commonCitiesOptions}
                                        placeholder="Enter Unloading Location"
                                    />
                                </div>
                            </div>

                            {/* Row 3: Weight, Hire, Advance */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Weight <span className="text-red-500">*</span>
                                    </label>
                                    <ValidatedInput
                                        fieldName="vehicleCapacity"
                                        validationRules={validationRules}
                                        value={note.vehicleCapacity || 0}
                                        onValueChange={(value) => handleValueChange('vehicleCapacity', value)}
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        placeholder="Weight"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Unit
                                    </label>
                                    <select
                                        value={note.weightUnit || 'Tons'}
                                        onChange={(e) => handleValueChange('weightUnit', e.target.value)}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    >
                                        <option value="KG">KG</option>
                                        <option value="MT">MT</option>
                                        <option value="Tons">Tons</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Total Truck Hire Fixed (₹) <span className="text-red-500">*</span>
                                    </label>
                                    <ValidatedInput
                                        fieldName="freightRate"
                                        validationRules={validationRules}
                                        value={note.freightRate || 0}
                                        onValueChange={(value) => handleValueChange('freightRate', value)}
                                        type="number"
                                        required
                                        min="0"
                                        step="1"
                                        placeholder="Total Hire Amount"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Advance Truck Hire (₹)
                                    </label>
                                    <ValidatedInput
                                        fieldName="advanceAmount"
                                        validationRules={validationRules}
                                        value={note.advanceAmount || 0}
                                        onValueChange={(value) => handleValueChange('advanceAmount', value)}
                                        type="number"
                                        min="0"
                                        step="1"
                                        placeholder="Advance Paid"
                                    />
                                </div>
                            </div>

                            {/* Row 4: Balance, Unloading Date */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Balance Truck Hire (₹)
                                    </label>
                                    <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-100 font-bold text-lg text-red-600">
                                        {balanceAmount.toLocaleString('en-IN')}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Unloading Date (Optional)
                                    </label>
                                    <Input
                                        label=""
                                        name="expectedDeliveryDate"
                                        value={note.expectedDeliveryDate || ''}
                                        onChange={handleChange}
                                        type="date"
                                    />
                                </div>
                            </div>

                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end space-x-2 pt-6 mt-6 border-t">
                            <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save THN'}
                            </Button>
                        </div>
                    </Card>
                </form>
            </div>
        </div>
    );
};
