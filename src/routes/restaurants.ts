import { Router } from 'express';
import * as controller from '../controllers/restaurantController.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../middleware/validateRequest.js';
import {
  CreateRestaurantBody,
  UpdateRestaurantBody,
  NearbyRestaurantQuery,
  ListRestaurantsQuery,
  RestaurantIdParam,
} from '../schemas/restaurantSchema.js';

const router = Router();

// IMPORTANT: /nearby must be registered BEFORE /:id
// so Express doesn't treat "nearby" as an id.
router.get('/nearby', validateQuery(NearbyRestaurantQuery), controller.getNearbyRestaurants);

router.post('/', validateBody(CreateRestaurantBody), controller.createRestaurant);
router.get('/', validateQuery(ListRestaurantsQuery), controller.listRestaurants);
router.get('/:id', validateParams(RestaurantIdParam), controller.getRestaurant);
router.patch(
  '/:id',
  validateParams(RestaurantIdParam),
  validateBody(UpdateRestaurantBody),
  controller.updateRestaurant
);
router.delete('/:id', validateParams(RestaurantIdParam), controller.deleteRestaurant);

export default router;