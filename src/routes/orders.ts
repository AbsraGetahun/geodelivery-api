import { Router } from 'express';
import * as controller from '../controllers/orderController.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../middleware/validateRequest.js';
import {
  CreateOrderBody,
  UpdateOrderStatusBody,
  AssignDriverBody,
  ListOrdersQuery,
  OrderIdParam,
} from '../schemas/orderSchema.js';

const router = Router();

// Routes in the exact specified order:
// POST   /
// GET    /
// GET    /:id
// GET    /:id/eta
// PATCH  /:id/status
// PATCH  /:id/assign
// DELETE /:id
router.post('/', validateBody(CreateOrderBody), controller.createOrder);
router.get('/', validateQuery(ListOrdersQuery), controller.listOrders);
router.get('/:id', validateParams(OrderIdParam), controller.getOrder);
router.get('/:id/eta', validateParams(OrderIdParam), controller.getEta);
router.patch(
  '/:id/status',
  validateParams(OrderIdParam),
  validateBody(UpdateOrderStatusBody),
  controller.updateOrderStatus
);
router.patch(
  '/:id/assign',
  validateParams(OrderIdParam),
  validateBody(AssignDriverBody),
  controller.assignDriver
);
router.delete('/:id', validateParams(OrderIdParam), controller.cancelOrder);

export default router;
