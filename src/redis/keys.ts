export function restaurantById(id: string): string {
  return `restaurant:${id}`;
}

export function restaurantsList(page: number, limit: number): string {
  return `restaurants:list:${page}:${limit}`;
}

export function restaurantsNearby(lat: number, lng: number, radius: number): string {
  return `restaurants:nearby:${lat}:${lng}:${radius}`;
}

export function driverById(id: string): string {
  return `driver:${id}`;
}

export function driversNearby(lat: number, lng: number, radius: number): string {
  return `drivers:nearby:${lat}:${lng}:${radius}`;
}

export const RESTAURANTS_PATTERN = 'restaurants:*';
export const RESTAURANT_NEARBY_PATTERN = 'restaurants:nearby:*';
export const DRIVER_PATTERN = 'driver:*';
export const DRIVERS_NEARBY_PATTERN = 'drivers:nearby:*';

export const TTL = {
  RESTAURANT_BY_ID: 600,   // 10 minutes
  RESTAURANTS_LIST: 300,   // 5 minutes
  RESTAURANTS_NEARBY: 300, // 5 minutes
  DRIVER_BY_ID: 60,        // 1 minute
  DRIVERS_NEARBY: 60,      // 1 minute
} as const;
