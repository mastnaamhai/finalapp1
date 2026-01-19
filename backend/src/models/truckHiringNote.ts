import { Schema, model, Document } from 'mongoose';
import { THNStatus } from '../types';

export interface ITruckHiringNote extends Document {
  thnNumber: number;
  date: string;
  truckNumber: string;
  vehicleCapacity: number;
  weightUnit?: 'KG' | 'MT' | 'Tons';
  loadingLocation: string;
  unloadingLocation: string;
  loadingDateTime: string;
  expectedDeliveryDate: string;
  agencyName: string;
  brokerContact?: string;
  freightRate: number;
  advanceAmount: number;
  balanceAmount: number;
  paymentTerms: string;
  additionalCharges?: number;
  remarks?: string;
  linkedLR?: string;
  linkedInvoice?: string;
  status: THNStatus;
  paidAmount: number;
  payments: Schema.Types.ObjectId[];
}

const TruckHiringNoteSchema = new Schema({
  thnNumber: { type: Number, unique: true, required: true },
  date: { type: String, required: true },
  truckNumber: { type: String, required: true },
  vehicleCapacity: { type: Number, required: true },
  weightUnit: {
    type: String,
    enum: ['KG', 'MT', 'Tons'],
    default: 'Tons'
  },
  loadingLocation: { type: String },
  unloadingLocation: { type: String },
  loadingDateTime: { type: String },
  expectedDeliveryDate: { type: String },
  agencyName: { type: String, required: true },
  brokerContact: { type: String },
  freightRate: { type: Number, required: true },
  advanceAmount: { type: Number, default: 0 },
  balanceAmount: { type: Number, required: true },
  paymentTerms: { type: String },
  additionalCharges: { type: Number, default: 0 },
  remarks: { type: String },
  linkedLR: { type: String },
  linkedInvoice: { type: String },
  goodsType: { type: String, default: '' },
  truckType: { type: String, default: '' },
  status: {
    type: String,
    enum: Object.values(THNStatus),
    default: THNStatus.UNPAID
  },
  paidAmount: { type: Number, default: 0 },
  payments: [{ type: Schema.Types.ObjectId, ref: 'Payment' }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total amount (freight + additional charges)
TruckHiringNoteSchema.virtual('totalAmount').get(function(this: ITruckHiringNote) {
  return this.freightRate + (this.additionalCharges || 0);
});

export default model<ITruckHiringNote>('TruckHiringNote', TruckHiringNoteSchema);
