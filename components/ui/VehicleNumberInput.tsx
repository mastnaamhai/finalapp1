import React, { useState, useRef, useEffect } from 'react';

interface VehicleNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  onValueChange?: (fieldName: string, value: string) => void;
  fieldName?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  className?: string;
}

export const VehicleNumberInput: React.FC<VehicleNumberInputProps> = ({
  value,
  onChange,
  onValueChange,
  fieldName,
  placeholder = "e.g., MH-12-AB-1234",
  required = false,
  error,
  className = ""
}) => {
  const [displayValue, setDisplayValue] = useState(formatVehicleNumber(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Format vehicle number to Indian standard: XX-00-XX-0000
  function formatVehicleNumber(input: string): string {
    // Remove all non-alphanumeric characters and convert to uppercase
    const cleaned = input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    // Apply formatting based on length
    if (cleaned.length <= 2) {
      return cleaned;
    } else if (cleaned.length <= 4) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    } else if (cleaned.length <= 6) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4)}`;
    } else {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 10)}`;
    }
  }

  // Convert formatted display value back to raw value for storage
  function unformatVehicleNumber(formatted: string): string {
    return formatted.replace(/-/g, '').toUpperCase();
  }

  useEffect(() => {
    const formatted = formatVehicleNumber(value);
    if (formatted !== displayValue) {
      setDisplayValue(formatted);
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const rawValue = unformatVehicleNumber(inputValue);

    // Only allow valid characters (letters and numbers)
    if (!/^[A-Za-z0-9-]*$/.test(inputValue)) {
      return;
    }

    // Update display value with formatting
    const formatted = formatVehicleNumber(rawValue);
    setDisplayValue(formatted);

    // Update parent with raw value
    onChange(rawValue);
    if (onValueChange && fieldName) {
      onValueChange(fieldName, rawValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow navigation keys
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab') {
      return;
    }

    // Prevent typing beyond maximum length
    if (displayValue.replace(/-/g, '').length >= 10 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${className}`}
        maxLength={14} // 2-2-2-4 with 3 hyphens = 13 chars, plus buffer
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};
