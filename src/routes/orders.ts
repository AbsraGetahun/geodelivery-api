import { Router } from 'express';
import * as controller from '../controllers/orderController.js';

const router = Router();

// Routes in the exact specified order:
// POST   /
// GET    /
// GET    /:id
// GET    /:id/eta
// PATCH  /:id/status
// PATCH  /:id/assign
// DELETE /:id
router.post('/', controller.createOrder);
router.get('/', controller.listOrders);
router.get('/:id', controller.getOrder);
router.get('/:id/eta', controller.getEta);
router.patch('/:id/status', controller.updateOrderStatus);
router.patch('/:id/assign', controller.assignDriver);
router.delete('/:id', controller.cancelOrder);

export default router;
