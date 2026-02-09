import express from 'express';
import {
    getCustomers,
    createCustomer,
    getCustomerById,
    getCustomerByGstin,
    getSyncCandidates,
    updateCustomer,
    deleteCustomer
} from '../controllers/customerController';
import { PaymentAllocationController } from '../controllers/paymentAllocationController';

const router = express.Router();

router.route('/')
    .get(getCustomers)
    .post(createCustomer);

router.route('/gstin/:gstin')
    .get(getCustomerByGstin);

router.route('/sync-candidates')
    .get(getSyncCandidates);

router.route('/:id/account-summary')
    .get(PaymentAllocationController.getCustomerAccountSummary);

router.route('/:id/unallocated-payments')
    .get(PaymentAllocationController.getUnallocatedPayments);

router.route('/:id')
    .get(getCustomerById)
    .put(updateCustomer)
    .delete(deleteCustomer);

export default router;
