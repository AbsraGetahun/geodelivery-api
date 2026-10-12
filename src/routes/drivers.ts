import { Router } from 'express';
import * as controller from '../controllers/driverController.js';

const router = Router();

// IMPORTANT: /nearby must be registered BEFORE /:id
// so Express doesn't treat "nearby" as an id.
router.get('/nearby', controller.getNearbyDrivers);
router.post('/', controller.createDriver);
router.get('/', controller.listDrivers);
router.get('/:id', controller.getDriver);
router.patch('/:id', controller.updateDriver);
router.patch('/:id/location', controller.updateDriverLocation);
router.patch('/:id/availability', controller.updateDriverAvailability);
router.delete('/:id', controller.deleteDriver);

export default router;
