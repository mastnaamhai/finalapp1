import express from 'express';
import {
    getPayments,
    createPayment,
    getPaymentById,
    updatePayment,
    deletePayment
} from '../controllers/paymentController';
import { PaymentAllocationController } from '../controllers/paymentAllocationController';

const router = express.Router();

// Payment allocation routes (must be before '/:id' routes to avoid conflicts)
router.post('/advance', PaymentAllocationController.recordAdvancePayment);
router.post('/bulk', PaymentAllocationController.recordBulkPayment);
router.post('/:id/allocate', PaymentAllocationController.allocatePaymentToInvoices);
router.post('/:id/reverse-allocation', PaymentAllocationController.reverseAllocation);

// Standard payment routes
router.route('/')
    .get(getPayments)
    .post(createPayment);

router.route('/:id')
    .get(getPaymentById)
    .put(updatePayment)
    .delete(deletePayment);

export default router;
