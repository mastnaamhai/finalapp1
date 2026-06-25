import React, { useState } from 'react';
import { Customer } from '../types';
import { CustomerAccountSummary, AdvancePaymentForm, BulkPaymentForm, PaymentAllocation } from './payment-allocation';
import { PaymentSummary } from '../types/paymentAllocation';

interface ClientAccountModalProps {
    client: Customer;
    onClose: () => void;
}

type ViewMode = 'summary' | 'advance' | 'bulk' | 'allocation';

export const ClientAccountModal: React.FC<ClientAccountModalProps> = ({ client, onClose }) => {
    const [view, setView] = useState<ViewMode>('summary');
    const [selectedPayment, setSelectedPayment] = useState<PaymentSummary | null>(null);

    const handleRefresh = () => {
        // Refresh logic is now handled inside CustomerAccountSummary or via local state if needed
    };

    const handleAllocate = (payment: PaymentSummary) => {
        setSelectedPayment(payment);
        setView('allocation');
    };

    const handleSuccess = () => {
        handleRefresh();
        setView('summary');
        setSelectedPayment(null);
    };

    const renderContent = () => {
        switch (view) {
            case 'advance':
                return (
                    <AdvancePaymentForm
                        customerId={client._id}
                        onSuccess={handleSuccess}
                        onCancel={() => setView('summary')}
                    />
                );
            case 'bulk':
                return (
                    <BulkPaymentForm
                        customerId={client._id}
                        onSuccess={handleSuccess}
                        onCancel={() => setView('summary')}
                    />
                );
            case 'allocation':
                if (!selectedPayment) return null;
                return (
                    <PaymentAllocation
                        payment={selectedPayment}
                        onSuccess={handleSuccess}
                        onCancel={() => {
                            setSelectedPayment(null);
                            setView('summary');
                        }}
                    />
                );
            case 'summary':
            default:
                return (
                    <div className="space-y-4">
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={() => setView('advance')}
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
                            >
                                Record Advance
                            </button>
                            <button
                                onClick={() => setView('bulk')}
                                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700"
                            >
                                Bulk Payment
                            </button>
                        </div>

                        {/* We need to pass a callback to trigger allocation from the summary list */}
                        {/* Since CustomerAccountSummary currently has its own "Allocate" button logic, 
                 we need to update it to accept an onAllocate prop or handle it internally.
                 Actually, I implemented a placeholder onClick in the Summary component. 
                 I should probably update CustomerAccountSummary to accept onAllocate prop.
              */}
                        {/* For now, I'll update CustomerAccountSummary to take onAllocate prop in next step */}
                        <CustomerAccountSummary
                            customerId={client._id}
                            onRefresh={handleRefresh}
                            onAllocate={handleAllocate}
                        />
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-50 flex flex-col">
            <div className="w-full flex-1 flex flex-col">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center space-x-3">
                        {view !== 'summary' && (
                            <button
                                onClick={() => setView('summary')}
                                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                                title="Back to Summary"
                            >
                                <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Account: {client.name}</h2>
                            {client.tradeName && <p className="text-sm text-gray-500">{client.tradeName}</p>}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    >
                        <span className="sr-only">Close</span>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1 bg-gray-50">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};
