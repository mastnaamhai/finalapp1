import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { simpleNumberingService } from '../services/simpleNumberingService';
import { API_BASE_URL } from '../constants';

export const SimpleNumberingSettings: React.FC = () => {
  const [invoiceStartingNumber, setInvoiceStartingNumber] = useState<number>(1001);
  const [consignmentStartingNumber, setConsignmentStartingNumber] = useState<number>(5001);
  const [thnStartingNumber, setThnStartingNumber] = useState<number>(2001);
  const [invoiceCurrentNumber, setInvoiceCurrentNumber] = useState<number>(1001);
  const [consignmentCurrentNumber, setConsignmentCurrentNumber] = useState<number>(5001);
  const [thnCurrentNumber, setThnCurrentNumber] = useState<number>(2001);
  const [invoicePrefix, setInvoicePrefix] = useState<string>('INV');
  const [consignmentPrefix, setConsignmentPrefix] = useState<string>('LR');
  const [thnPrefix, setThnPrefix] = useState<string>('THN');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    setIsLoading(true);
    try {
      // First sync current numbers with existing data
      await fetch(`${API_BASE_URL}/api/numbering/sync-current`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      // Initialize if not already done, otherwise reload
      if (!simpleNumberingService['isInitialized']) {
        await simpleNumberingService.initialize();
      } else {
        await simpleNumberingService.reloadConfigs();
      }

      const invoiceConfig = simpleNumberingService.getConfig('invoice');
      const consignmentConfig = simpleNumberingService.getConfig('consignment');
      const thnConfig = simpleNumberingService.getConfig('truckHiringNoteId');

      // Set values from configs if available, otherwise keep defaults
      if (invoiceConfig) {
        setInvoiceStartingNumber(invoiceConfig.startingNumber);
        setInvoiceCurrentNumber(invoiceConfig.currentNumber);
        setInvoicePrefix(invoiceConfig.prefix || 'INV');
      }
      if (consignmentConfig) {
        setConsignmentStartingNumber(consignmentConfig.startingNumber);
        setConsignmentCurrentNumber(consignmentConfig.currentNumber);
        setConsignmentPrefix(consignmentConfig.prefix || 'LR');
      }
      if (thnConfig) {
        setThnStartingNumber(thnConfig.startingNumber);
        setThnCurrentNumber(thnConfig.currentNumber);
        setThnPrefix(thnConfig.prefix || 'THN');
      }
    } catch (error) {
      console.error('Failed to load numbering configurations:', error);
      setMessage({ type: 'error', text: 'Failed to load current settings' });
    } finally {
      setIsLoading(false);
    }
  };

  const validateStartingNumbers = () => {
    const errors = [];

    // Check invoice starting number
    if (invoiceStartingNumber < invoiceCurrentNumber) {
      errors.push(`Invoice starting number (${invoiceStartingNumber}) cannot be less than current number (${invoiceCurrentNumber})`);
    }

    // Check consignment starting number
    if (consignmentStartingNumber < consignmentCurrentNumber) {
      errors.push(`Consignment starting number (${consignmentStartingNumber}) cannot be less than current number (${consignmentCurrentNumber})`);
    }

    // Check THN starting number
    if (thnStartingNumber < thnCurrentNumber) {
      errors.push(`Truck Hiring Note starting number (${thnStartingNumber}) cannot be less than current number (${thnCurrentNumber})`);
    }

    return errors;
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    // Validate starting numbers
    const validationErrors = validateStartingNumbers();
    if (validationErrors.length > 0) {
      setMessage({ type: 'error', text: validationErrors.join('. ') });
      setIsSaving(false);
      return;
    }

    try {
      // Save invoice configuration
      await simpleNumberingService.saveConfig('invoice', invoiceStartingNumber, invoicePrefix);

      // Save consignment configuration
      await simpleNumberingService.saveConfig('consignment', consignmentStartingNumber, consignmentPrefix);

      // Save THN configuration
      await simpleNumberingService.saveConfig('truckHiringNoteId', thnStartingNumber, thnPrefix);

      setMessage({ type: 'success', text: 'Numbering settings saved successfully!' });

      // Reload configurations to get updated current numbers
      await loadConfigurations();
    } catch (error) {
      console.error('Failed to save numbering configurations:', error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setInvoiceStartingNumber(1001);
    setConsignmentStartingNumber(5001);
    setThnStartingNumber(2001);
    setInvoiceCurrentNumber(1001);
    setConsignmentCurrentNumber(5001);
    setThnCurrentNumber(2001);
    setInvoicePrefix('INV');
    setConsignmentPrefix('LR');
    setThnPrefix('THN');
  };

  const handleSync = async (type: 'invoice' | 'consignment' | 'truckHiringNoteId') => {
    try {
      const config = simpleNumberingService.getConfig(type);
      if (config) {
        if (type === 'invoice') {
          setInvoiceStartingNumber(config.currentNumber);
        } else if (type === 'consignment') {
          setConsignmentStartingNumber(config.currentNumber);
        } else if (type === 'truckHiringNoteId') {
          setThnStartingNumber(config.currentNumber);
        }
        setMessage({ type: 'success', text: `${type.charAt(0).toUpperCase() + type.slice(1)} numbering synced successfully!` });
      }
    } catch (error) {
      console.error('Failed to sync numbering:', error);
      setMessage({ type: 'error', text: 'Failed to sync numbering. Please try again.' });
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading numbering settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-800">Numbering Settings</h3>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadConfigurations()}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh Numbers'}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={isSaving}>
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <Card title="Auto-Generation Settings">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-semibold text-gray-700">Invoice Numbers</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSync('invoice')}
                  disabled={isSaving}
                >
                  Sync
                </Button>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-600">
                    Current Number
                  </label>
                  <span className="text-sm text-gray-500">
                    Next: {simpleNumberingService.formatNumber('invoice', invoiceCurrentNumber)}
                  </span>
                </div>
                <Input
                  type="number"
                  value={invoiceCurrentNumber}
                  readOnly
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500">
                  Current auto-generated number: {invoiceCurrentNumber}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-600">
                    Starting Number
                  </label>
                  <Input
                    type="number"
                    value={invoiceStartingNumber}
                    onChange={(e) => setInvoiceStartingNumber(parseInt(e.target.value) || 1001)}
                    min="1"
                    placeholder="1001"
                  />
                  <p className="text-xs text-gray-500">
                    New invoices will start from this number
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-600">
                    Prefix (Optional)
                  </label>
                  <Input
                    type="text"
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value)}
                    placeholder="INV"
                    maxLength={10}
                  />
                  <p className="text-xs text-gray-500">
                    Prefix for invoice numbers (e.g., INV1001)
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-semibold text-gray-700">Consignment Note Numbers</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSync('consignment')}
                  disabled={isSaving}
                >
                  Sync
                </Button>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-600">
                    Current Number
                  </label>
                  <span className="text-sm text-gray-500">
                    Next: {simpleNumberingService.formatNumber('consignment', consignmentCurrentNumber)}
                  </span>
                </div>
                <Input
                  type="number"
                  value={consignmentCurrentNumber}
                  readOnly
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500">
                  Current auto-generated number: {consignmentCurrentNumber}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-600">
                    Starting Number
                  </label>
                  <Input
                    type="number"
                    value={consignmentStartingNumber}
                    onChange={(e) => setConsignmentStartingNumber(parseInt(e.target.value) || 5001)}
                    min="1"
                    placeholder="5001"
                  />
                  <p className="text-xs text-gray-500">
                    New consignment notes will start from this number
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-600">
                    Prefix (Optional)
                  </label>
                  <Input
                    type="text"
                    value={consignmentPrefix}
                    onChange={(e) => setConsignmentPrefix(e.target.value)}
                    placeholder="LR"
                    maxLength={10}
                  />
                  <p className="text-xs text-gray-500">
                    Prefix for consignment numbers (e.g., LR5001)
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-semibold text-gray-700">Truck Hire Note Numbers</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSync('truckHiringNoteId')}
                  disabled={isSaving}
                >
                  Sync
                </Button>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-600">
                    Current Number
                  </label>
                  <span className="text-sm text-gray-500">
                    Next: {simpleNumberingService.formatNumber('truckHiringNoteId', thnCurrentNumber)}
                  </span>
                </div>
                <Input
                  type="number"
                  value={thnCurrentNumber}
                  readOnly
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500">
                  Current auto-generated number: {thnCurrentNumber}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-600">
                    Starting Number
                  </label>
                  <Input
                    type="number"
                    value={thnStartingNumber}
                    onChange={(e) => setThnStartingNumber(parseInt(e.target.value) || 2001)}
                    min="1"
                    placeholder="2001"
                  />
                  <p className="text-xs text-gray-500">
                    New truck hire notes will start from this number
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-600">
                    Prefix (Optional)
                  </label>
                  <Input
                    type="text"
                    value={thnPrefix}
                    onChange={(e) => setThnPrefix(e.target.value)}
                    placeholder="THN"
                    maxLength={10}
                  />
                  <p className="text-xs text-gray-500">
                    Prefix for truck hire numbers (e.g., THN2001)
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-semibold text-blue-800 mb-2">How it works:</h5>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>Auto-Generation:</strong> Numbers are automatically assigned starting from your configured starting numbers</li>
              <li>• <strong>Manual Entry:</strong> You can also manually enter any number when creating invoices, consignment notes, or truck hire notes</li>
              <li>• <strong>Uniqueness:</strong> The system ensures all numbers are unique across all records</li>
              <li>• <strong>Prefixes:</strong> You can set custom prefixes for invoice, consignment, and truck hire note numbers</li>
              <li>• <strong>Examples:</strong> INV1001, LR5001, THN2001... (based on your settings)</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};
