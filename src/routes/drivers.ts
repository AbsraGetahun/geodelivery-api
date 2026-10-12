import { Router } from 'express';
import * as controller from '../controllers/driverController.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../middleware/validateRequest.js';
import {
  CreateDriverBody,
  UpdateDriverBody,
  UpdateDriverLocationBody,
  UpdateDriverAvailabilityBody,
  NearbyDriverQuery,
  ListDriversQuery,
  DriverIdParam,
} from '../schemas/driverSchema.js';

const router = Router();

// IMPORTANT: /nearby must be registered BEFORE /:id
// so Express doesn't treat "nearby" as an id.
router.get('/nearby', validateQuery(NearbyDriverQuery), controller.getNearbyDrivers);
router.post('/', validateBody(CreateDriverBody), controller.createDriver);
router.get('/', validateQuery(ListDriversQuery), controller.listDrivers);
router.get('/:id', validateParams(DriverIdParam), controller.getDriver);
router.patch(
  '/:id',
  validateParams(DriverIdParam),
  validateBody(UpdateDriverBody),
  controller.updateDriver
);
router.patch(
  '/:id/location',
  validateParams(DriverIdParam),
  validateBody(UpdateDriverLocationBody),
  controller.updateDriverLocation
);
router.patch(
  '/:id/availability',
  validateParams(DriverIdParam),
  validateBody(UpdateDriverAvailabilityBody),
  controller.updateDriverAvailability
);
router.delete('/:id', validateParams(DriverIdParam), controller.deleteDriver);

export default router;
