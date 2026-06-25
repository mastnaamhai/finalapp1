import React, { useState, useMemo } from 'react';
import { PageContainer } from './ui/PageContainer';
import { PageHeader } from './ui/PageHeader';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { UniversalSearchSort, SortOption } from './ui/UniversalSearchSort';
import { Pagination } from './ui/Pagination';
import { StatusBadge, getStatusVariant } from './ui/StatusBadge';
import { TruckHiringNoteForm } from './TruckHiringNoteForm';
import { UniversalPaymentForm } from './UniversalPaymentForm';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { UniversalPaymentHistoryModal } from './UniversalPaymentHistoryModal';
import { formatDate } from '../services/utils';
import type { TruckHiringNote, Payment, CompanyInfo, View } from '../types';

interface TruckHiringNotesProps {
    notes: TruckHiringNote[];
    payments: Payment[];
    companyInfo: CompanyInfo;
    onSave: (note: Partial<TruckHiringNote>) => Promise<void>;
    onUpdate: (id: string, note: Partial<TruckHiringNote>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onSavePayment: (payment: Omit<Payment, '_id'>) => Promise<void>;
    onViewChange: (view: View) => void;
    onBack?: () => void;
    initialFilters?: { searchTerm?: string };
}

export const TruckHiringNotes: React.FC<TruckHiringNotesProps> = ({
    notes, payments, companyInfo, onSave, onUpdate, onDelete, onSavePayment, onViewChange, onBack, initialFilters
}) => {
    // State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<TruckHiringNote | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState(initialFilters?.searchTerm || '');
    const [sortBy, setSortBy] = useState<keyof TruckHiringNote>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
    const [selectedNoteForPayment, setSelectedNoteForPayment] = useState<TruckHiringNote | null>(null);

    const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = useState(false);
    const [selectedNoteForHistory, setSelectedNoteForHistory] = useState<TruckHiringNote | null>(null);

    const [isPodDateModalOpen, setIsPodDateModalOpen] = useState(false);
    const [selectedNoteForPodDate, setSelectedNoteForPodDate] = useState<TruckHiringNote | null>(null);
    const [podDate, setPodDate] = useState('');
    const [isPodDateSaving, setIsPodDateSaving] = useState(false);
    // ...
    // Derived State
    const filteredNotes = useMemo(() => {
        return notes
            .filter(note => {
                const searchLower = searchTerm.toLowerCase();
                return (
                    String(note.thnNumber).toLowerCase().includes(searchLower) ||
                    (note.truckNumber && note.truckNumber.toLowerCase().includes(searchLower)) ||
                    (note.agencyName && note.agencyName.toLowerCase().includes(searchLower)) ||
                    (note.loadingLocation && note.loadingLocation.toLowerCase().includes(searchLower)) ||
                    (note.unloadingLocation && note.unloadingLocation.toLowerCase().includes(searchLower)) ||
                    (note.status && note.status.toLowerCase().includes(searchLower))
                );
            })
            .sort((a, b) => {
                const aValue = a[sortBy];
                const bValue = b[sortBy];

                if (aValue === undefined || bValue === undefined) return 0;

                const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
                return sortOrder === 'asc' ? comparison : -comparison;
            });
    }, [notes, searchTerm, sortBy, sortOrder]);

    const paginatedNotes = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredNotes.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredNotes, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredNotes.length / itemsPerPage);

    const sortOptions: SortOption[] = [
        { label: 'Date', value: 'date' },
        { label: 'THN Number', value: 'thnNumber' },
        { label: 'Agency Name', value: 'agencyName' },
        { label: 'Amount', value: 'freightRate' },
        { label: 'Status', value: 'status' }
    ];

    // Handlers
    const handleAddNew = () => {
        setEditingNote(undefined);
        setIsFormOpen(true);
    };

    const handleEdit = (note: TruckHiringNote) => {
        setEditingNote(note);
        setIsFormOpen(true);
    };

    const handleDelete = async (note: TruckHiringNote) => {
        if (window.confirm(`Are you sure you want to delete THN #${note.thnNumber}?`)) {
            await onDelete(note._id);
        }
    };

    const handleSave = async (note: Partial<TruckHiringNote>) => {
        if (editingNote) {
            await onUpdate(editingNote._id, note);
        } else {
            await onSave(note);
        }
        setIsFormOpen(false);
        setEditingNote(undefined);
    };

    const handleAddPayment = (note: TruckHiringNote) => {
        setSelectedNoteForPayment(note);
        setIsPaymentFormOpen(true);
    };

    const handleSavePayment = async (payment: Omit<Payment, '_id'>) => {
        await onSavePayment(payment);
        setIsPaymentFormOpen(false);
        setSelectedNoteForPayment(null);
    };

    const handleViewPaymentHistory = (note: TruckHiringNote) => {
        setSelectedNoteForHistory(note);
        setIsPaymentHistoryOpen(true);
    };

    const handleAddPodDate = (note: TruckHiringNote) => {
        setSelectedNoteForPodDate(note);
        setPodDate(note.podDate ? new Date(note.podDate).toISOString().split('T')[0] : '');
        setIsPodDateModalOpen(true);
    };

    const handleClosePodDateModal = () => {
        setIsPodDateModalOpen(false);
        setSelectedNoteForPodDate(null);
        setPodDate('');
    };

    const handleSavePodDate = async () => {
        if (!selectedNoteForPodDate) return;

        setIsPodDateSaving(true);
        try {
            await onUpdate(selectedNoteForPodDate._id, {
                ...selectedNoteForPodDate,
                podDate: podDate ? new Date(podDate).toISOString() : undefined
            });
            handleClosePodDateModal();
        } catch (error) {
            console.error('Failed to save POD date:', error);
        } finally {
            setIsPodDateSaving(false);
        }
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        setCurrentPage(1);
    };

    return (
        <PageContainer>
            {isFormOpen && (
                <TruckHiringNoteForm
                    existingNote={editingNote}
                    companyInfo={companyInfo}
                    onSave={handleSave}
                    onCancel={() => setIsFormOpen(false)}
                />
            )}

            {isPaymentFormOpen && selectedNoteForPayment && (
                <UniversalPaymentForm
                    truckHiringNoteId={selectedNoteForPayment._id}
                    customerId={undefined} // No customer for THN payments
                    grandTotal={(selectedNoteForPayment.freightRate + (selectedNoteForPayment.additionalCharges || 0))}
                    balanceDue={selectedNoteForPayment.balanceAmount}
                    onSave={handleSavePayment}
                    onClose={() => {
                        setIsPaymentFormOpen(false);
                        setSelectedNoteForPayment(null);
                    }}
                    title={`Add Payment for THN #${selectedNoteForPayment.thnNumber}`}
                />
            )}

            {isPaymentHistoryOpen && selectedNoteForHistory && (
                <UniversalPaymentHistoryModal
                    truckHiringNote={selectedNoteForHistory}
                    payments={payments}
                    onClose={() => {
                        setIsPaymentHistoryOpen(false);
                        setSelectedNoteForHistory(null);
                    }}
                />
            )}

            {isPodDateModalOpen && selectedNoteForPodDate && (
                <ConfirmationModal
                    isOpen={isPodDateModalOpen}
                    onClose={handleClosePodDateModal}
                    onConfirm={handleSavePodDate}
                    title={`Add POD Date for THN #${selectedNoteForPodDate.thnNumber}`}
                    message="Select the Proof of Delivery date:"
                    confirmText="Save POD Date"
                    cancelText="Cancel"
                    isLoading={isPodDateSaving}
                >
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            POD Date
                        </label>
                        <input
                            type="date"
                            value={podDate}
                            onChange={(e) => setPodDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Leave empty to remove POD date
                        </p>
                    </div>
                </ConfirmationModal>
            )}

            <PageHeader
                title="Truck Hiring Notes"
                subtitle="Manage your truck hiring records"
                actions={
                    <Button onClick={handleAddNew}>Add New THN</Button>
                }
            />

            <Card>
                <UniversalSearchSort
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    searchPlaceholder="Search by THN number, broker name, truck number, locations, or status..."
                    sortBy={sortBy}
                    onSortChange={(value) => setSortBy(value as keyof TruckHiringNote)}
                    sortOrder={sortOrder}
                    onSortOrderChange={setSortOrder}
                    sortOptions={sortOptions}
                    totalItems={notes.length}
                    filteredItems={filteredNotes.length}
                    onClearSearch={handleClearSearch}
                />
            </Card>

            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-slate-100">
                            <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">THN No.</th>
                                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Truck Details</th>
                                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broker</th>
                                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Freight</th>
                                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Advance</th>
                                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                                <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {paginatedNotes.map(note => (
                                <tr
                                    key={note._id}
                                    className="hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
                                    onClick={() => onViewChange({ name: 'VIEW_THN', id: note._id })}
                                >
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                        #{note.thnNumber}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                        {formatDate(note.date)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                        <div>
                                            <div className="font-medium">{note.truckNumber}</div>
                                            <div className="text-xs text-gray-400">{note.truckType}</div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                        <div>
                                            <div>{note.loadingLocation} → {note.unloadingLocation}</div>
                                            <div className="text-xs text-gray-400">{note.goodsType}</div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                        <div>
                                            <div className="font-medium">{note.agencyName}</div>
                                            {note.brokerContact && (
                                                <div className="text-xs text-gray-400">{note.brokerContact}</div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">
                                        ₹{(note.freightRate || 0).toLocaleString('en-IN')}
                                        {(note.additionalCharges || 0) > 0 && (
                                            <div className="text-xs text-gray-400">+₹{(note.additionalCharges || 0).toLocaleString('en-IN')}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-blue-600 text-right">
                                        ₹{(note.advanceAmount || 0).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-600 text-right">
                                        ₹{(note.paidAmount || 0).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-red-600 text-right">
                                        ₹{(note.balanceAmount || 0).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                        <StatusBadge status={note.status} variant={getStatusVariant(note.status)} size="sm" />
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onViewChange({ name: 'VIEW_THN', id: note._id }); }}
                                            className="text-indigo-600 hover:text-indigo-900 transition-colors"
                                            title="View PDF"
                                        >
                                            View PDF
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleAddPayment(note); }}
                                            className="text-green-600 hover:text-green-900 transition-colors"
                                            title="Add Payment"
                                        >
                                            Payment
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleViewPaymentHistory(note); }}
                                            className="text-purple-600 hover:text-purple-900 transition-colors"
                                            title="View Payment History"
                                        >
                                            History
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleEdit(note); }}
                                            className="text-blue-600 hover:text-blue-900 transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(note); }}
                                            className="text-red-600 hover:text-red-900 transition-colors"
                                        >
                                            Delete
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleAddPodDate(note); }}
                                            className="text-blue-600 hover:text-blue-900 transition-colors"
                                            title="Add POD Date"
                                        >
                                            POD Date
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredNotes.length === 0 && (
                                <tr>
                                    <td colSpan={11} className="text-center py-8 text-gray-500">
                                        No Truck Hiring Notes found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="mt-6">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredNotes.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                </div>
            </Card>
        </PageContainer>
    );
};
