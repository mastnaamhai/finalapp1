import { Schema, model, Document } from 'mongoose';
import { Customer as ICustomerType } from '../types';

export interface ICustomer extends Omit<ICustomerType, '_id'>, Document { }

const CustomerSchema = new Schema({
  name: { type: String, required: true },
  tradeName: { type: String },
  address: { type: String },
  state: { type: String },
  gstin: { type: String, unique: true, sparse: true }, // Unique but allow null values
  contactPerson: { type: String },
  contactPhone: { type: String },
  contactEmail: { type: String },
  city: { type: String },
  pin: { type: String },
  phone: { type: String },
  email: { type: String },
  // Add metadata for GSTIN caching
  gstinLastVerified: { type: Date },
  gstinSource: { type: String, enum: ['api', 'manual'], default: 'manual' },
  // Ledger tracking fields for payment allocation
  creditBalance: { type: Number, default: 0 }, // Overall balance (+ = customer owes us, - = we owe customer)
  totalOutstanding: { type: Number, default: 0 }, // Sum of unpaid invoice amounts
  advancePayments: { type: Number, default: 0 }, // Total unallocated advance payments
  creditLimit: { type: Number }, // Optional credit limit for customer
  lastPaymentDate: { type: String }, // Track last payment received
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Note: GSTIN index is automatically created by unique: true in schema

// Indexes for payment allocation queries
CustomerSchema.index({ creditBalance: 1 });
CustomerSchema.index({ totalOutstanding: 1 });
CustomerSchema.index({ advancePayments: 1 });

export default model<ICustomer>('Customer', CustomerSchema);
