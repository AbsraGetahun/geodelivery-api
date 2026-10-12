// Shared API types

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface NearbyQuery {
  lat?: string;
  lng?: string;
  radius?: string; // meters
}

export interface RestaurantWithDistance {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  lat: number;
  lng: number;
  distance_meters: number;
}

export interface ApiError {
  error: string;
  details?: unknown;
}