import { Schema, model, Document } from 'mongoose';
import { PaymentType, PaymentMode } from '../types';

export interface IPayment extends Document {
  paymentNumber: number;
  invoiceId?: Schema.Types.ObjectId;
  truckHiringNoteId?: Schema.Types.ObjectId;
  customer?: Schema.Types.ObjectId;
  date: string;
  amount: number;
  type: PaymentType;
  mode: PaymentMode;
  referenceNo?: string;
  notes?: string;
  // TDS fields
  tdsApplicable?: boolean;
  tdsRate?: number;
  tdsAmount?: number;
  tdsDate?: string;
  // Settlement tracking
  settlements?: {
    invoiceId: Schema.Types.ObjectId;
    amount: number;
    date: string;
    allocatedBy?: string;
  }[];
  unsettledAmount?: number;
  // Payment allocation tracking
  allocationType?: 'invoice-specific' | 'advance' | 'multi-invoice';
  isAdvancePayment?: boolean;
  allocatedAmount?: number;
  unallocatedAmount?: number;
  status?: 'unallocated' | 'partially-allocated' | 'fully-allocated';
}

const PaymentSchema = new Schema({
  paymentNumber: { type: Number, required: true, unique: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: false },
  truckHiringNoteId: { type: Schema.Types.ObjectId, ref: 'TruckHiringNote', required: false },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: false },
  date: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: Object.values(PaymentType), required: true },
  mode: { type: String, enum: Object.values(PaymentMode), required: true },
  referenceNo: { type: String },
  notes: { type: String },
  // TDS fields
  tdsApplicable: { type: Boolean, default: false },
  tdsRate: { type: Number },
  tdsAmount: { type: Number },
  tdsDate: { type: String },
  // Settlement tracking
  settlements: [{
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    amount: { type: Number, required: true },
    date: { type: String, required: true },
    allocatedBy: { type: String } // User who made the allocation
  }],
  unsettledAmount: { type: Number, default: 0 },
  // Payment allocation tracking
  allocationType: {
    type: String,
    enum: ['invoice-specific', 'advance', 'multi-invoice'],
    default: 'invoice-specific'
  },
  isAdvancePayment: { type: Boolean, default: false },
  allocatedAmount: { type: Number, default: 0 },
  unallocatedAmount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['unallocated', 'partially-allocated', 'fully-allocated'],
    default: 'fully-allocated'
  }
});

// Indexes for payment allocation queries
PaymentSchema.index({ customer: 1, status: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ isAdvancePayment: 1 });
PaymentSchema.index({ allocationType: 1 });
PaymentSchema.index({ unallocatedAmount: 1 });

export default model<IPayment>('Payment', PaymentSchema);
