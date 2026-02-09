import React, { useState, useMemo } from 'react';
import { PageContainer } from './ui/PageContainer';
import { PageHeader } from './ui/PageHeader';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Pagination } from './ui/Pagination';
import { ClientFormModal } from './ClientFormModal';
import { ClientAccountModal } from './ClientAccountModal';
import type { Customer, Payment, Invoice } from '../types';

interface ClientsProps {
    customers: Customer[];
    payments?: Payment[];
    invoices?: Invoice[];
    onSave: (client: Omit<Customer, '_id'> | Customer) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onSavePayment?: (payment: any) => Promise<void>;
    onBack?: () => void;
}

export const Clients = ({ customers, payments = [], invoices = [], onSave, onDelete, onSavePayment, onBack }: ClientsProps) => {
    // State
    const [editingClient, setEditingClient] = useState<Customer | undefined>(undefined);
    const [accountClient, setAccountClient] = useState<Customer | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'state' | 'gstin' | 'contactPerson'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Derived State
    const filteredAndSortedCustomers = useMemo(() => {
        return customers
            .filter(customer => {
                const searchLower = searchTerm.toLowerCase();
                return (
                    customer.name?.toLowerCase().includes(searchLower) ||
                    customer.tradeName?.toLowerCase().includes(searchLower) ||
                    customer.gstin?.toLowerCase().includes(searchLower) ||
                    customer.state?.toLowerCase().includes(searchLower) ||
                    customer.contactPerson?.toLowerCase().includes(searchLower) ||
                    customer.contactPhone?.toLowerCase().includes(searchLower) ||
                    customer.address?.toLowerCase().includes(searchLower)
                );
            })
            .sort((a, b) => {
                let aValue = '';
                let bValue = '';

                switch (sortBy) {
                    case 'name':
                        aValue = a.name;
                        bValue = b.name;
                        break;
                    case 'state':
                        aValue = a.state;
                        bValue = b.state;
                        break;
                    case 'gstin':
                        aValue = a.gstin || '';
                        bValue = b.gstin || '';
                        break;
                    case 'contactPerson':
                        aValue = a.contactPerson || '';
                        bValue = b.contactPerson || '';
                        break;
                }

                const comparison = aValue.localeCompare(bValue);
                return sortOrder === 'asc' ? comparison : -comparison;
            });
    }, [customers, searchTerm, sortBy, sortOrder]);

    const paginatedCustomers = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredAndSortedCustomers.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredAndSortedCustomers, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredAndSortedCustomers.length / itemsPerPage);

    // Handlers
    const handleAddNew = () => {
        setEditingClient(undefined);
    };

    const handleEdit = (client: Customer) => {
        setEditingClient(client);
    };

    const handleCloseModal = () => {
        setEditingClient(undefined);
    };

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        setCurrentPage(1);
    };

    const handleSortChange = (value: 'name' | 'state' | 'gstin' | 'contactPerson') => {
        if (sortBy === value) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(value);
            setSortOrder('asc');
        }
    };

    return (
        <PageContainer>
            {editingClient && <ClientFormModal client={editingClient} onSave={onSave} onClose={handleCloseModal} />}
            {accountClient && (
                <ClientAccountModal
                    client={accountClient}
                    onClose={() => setAccountClient(undefined)}
                />
            )}
            <PageHeader
                title="Manage Clients"
                subtitle="View and manage your customer database"
                actions={
                    <Button onClick={handleAddNew}>Add New Client</Button>
                }
            />
            <Card>
                {/* Search and Sort Controls */}
                {/* Search and Sort Controls */}
                <div className="mb-6 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Search Bar */}
                        <div className="flex-1">
                            <Input
                                label="Search Clients"
                                placeholder="Search by name, trade name, GSTIN, state, contact info, or address..."
                                value={searchTerm}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                icon={
                                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                }
                            />
                        </div>

                        {/* Sort Controls */}
                        <div className="flex gap-2">
                            <Select
                                value={sortBy}
                                onChange={(e) => handleSortChange(e.target.value as 'name' | 'state' | 'gstin' | 'contactPerson')}
                                className="min-w-[140px]"
                            >
                                <option value="name">Sort by Name</option>
                                <option value="state">Sort by State</option>
                                <option value="gstin">Sort by GSTIN</option>
                                <option value="contactPerson">Sort by Contact</option>
                            </Select>

                            <Button
                                variant="outline"
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className="px-3"
                                title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                            >
                                {sortOrder === 'asc' ? (
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                                    </svg>
                                ) : (
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                                    </svg>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Results Summary */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <p className="text-sm text-gray-600">
                                Showing <span className="font-semibold text-gray-800">{paginatedCustomers.length}</span> of{' '}
                                <span className="font-semibold text-gray-800">{filteredAndSortedCustomers.length}</span> clients
                                {searchTerm && (
                                    <span className="ml-1">
                                        (filtered from <span className="font-semibold text-gray-800">{customers.length}</span> total)
                                    </span>
                                )}
                            </p>

                            {/* Sort Status */}
                            <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                Sorted by {sortBy === 'name' ? 'Name' : sortBy === 'state' ? 'State' : sortBy === 'gstin' ? 'GSTIN' : 'Contact'} ({sortOrder === 'asc' ? 'A-Z' : 'Z-A'})
                            </div>
                        </div>

                        {searchTerm && (
                            <Button
                                variant="link"
                                onClick={() => handleSearchChange('')}
                                className="text-sm text-gray-500 hover:text-gray-700"
                            >
                                Clear Search
                            </Button>
                        )}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-slate-100">
                            <tr>
                                <th
                                    className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-slate-200 transition-colors"
                                    onClick={() => handleSortChange('name')}
                                >
                                    <div className="flex items-center space-x-1">
                                        <span>Client Name</span>
                                        {sortBy === 'name' && (
                                            <span className="text-indigo-600">
                                                {sortOrder === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-slate-200 transition-colors"
                                    onClick={() => handleSortChange('state')}
                                >
                                    <div className="flex items-center space-x-1">
                                        <span>Address & State</span>
                                        {sortBy === 'state' && (
                                            <span className="text-indigo-600">
                                                {sortOrder === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-slate-200 transition-colors"
                                    onClick={() => handleSortChange('gstin')}
                                >
                                    <div className="flex items-center space-x-1">
                                        <span>GSTIN</span>
                                        {sortBy === 'gstin' && (
                                            <span className="text-indigo-600">
                                                {sortOrder === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-slate-200 transition-colors"
                                    onClick={() => handleSortChange('contactPerson')}
                                >
                                    <div className="flex items-center space-x-1">
                                        <span>Contact Info</span>
                                        {sortBy === 'contactPerson' && (
                                            <span className="text-indigo-600">
                                                {sortOrder === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {paginatedCustomers.map(client => (
                                <tr key={client._id} className="hover:bg-slate-50 transition-colors duration-200">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm align-top">
                                        <div className="font-medium text-gray-900">{client.name}</div>
                                        {client.tradeName && <div className="text-gray-500">{client.tradeName}</div>}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500 align-top">
                                        <p className="whitespace-pre-line">{client.address}</p>
                                        <p className="font-semibold text-gray-700 mt-1">{client.state}</p>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 align-top">{client.gstin || '-'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 align-top">
                                        {client.contactPerson && <div className="font-semibold">{client.contactPerson}</div>}
                                        {client.contactPhone && <div className="text-xs">{client.contactPhone}</div>}
                                        {client.contactEmail && <div className="text-xs">{client.contactEmail}</div>}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2 align-top">
                                        <button onClick={() => setAccountClient(client)} className="text-green-600 hover:text-green-900 transition-colors">Account</button>
                                        <button onClick={() => handleEdit(client)} className="text-indigo-600 hover:text-indigo-900 transition-colors">Edit</button>
                                        <button onClick={() => onDelete(client._id)} className="text-red-600 hover:text-red-900 transition-colors">Delete</button>
                                    </td>
                                </tr>
                            ))}
                            {paginatedCustomers.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-gray-500">
                                        {searchTerm ? (
                                            <div>
                                                <p>No clients found matching "{searchTerm}"</p>
                                                <Button
                                                    variant="link"
                                                    onClick={() => handleSearchChange('')}
                                                    className="mt-2 text-sm"
                                                >
                                                    Clear search to see all clients
                                                </Button>
                                            </div>
                                        ) : (
                                            "No clients found. Click 'Add New Client' to get started."
                                        )}
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
                        totalItems={filteredAndSortedCustomers.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                </div>
            </Card>
        </PageContainer>
    );
};
