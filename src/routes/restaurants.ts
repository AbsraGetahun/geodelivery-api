import { Router } from 'express';
import * as controller from '../controllers/restaurantController.js';

const router = Router();

// IMPORTANT: /nearby must be registered BEFORE /:id
// so Express doesn't treat "nearby" as an id.
router.get('/nearby', controller.getNearbyRestaurants);

router.post('/', controller.createRestaurant);
router.get('/', controller.listRestaurants);
router.get('/:id', controller.getRestaurant);
router.patch('/:id', controller.updateRestaurant);
router.delete('/:id', controller.deleteRestaurant);

export default router;