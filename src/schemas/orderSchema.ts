import { z } from 'zod';

export const VALID_ORDER_STATUSES = [
  'pending',
  'accepted',
  'picked_up',
  'in_transit',
  'delivered',
  'cancelled',
] as const;

export const CreateOrderBody = z.object({
  customer_name: z.string().trim().min(1).max(255),
  customer_phone: z.string().max(20).optional(),
  restaurant_id: z.string().uuid(),
  total_amount: z
    .number()
    .positive()
    .max(1_000_000)
    .refine((val) => Number(val.toFixed(2)) === val, {
      message: 'total_amount must have at most 2 decimal places',
    }),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const UpdateOrderStatusBody = z.object({
  status: z.enum(VALID_ORDER_STATUSES),
});

export const AssignDriverBody = z.object({
  driver_id: z.string().uuid(),
});

export const ListOrdersQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(VALID_ORDER_STATUSES).optional(),
  from: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  to: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
});

export const OrderIdParam = z.object({
  id: z.string().uuid(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderBody>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusBody>;
export type AssignDriverInput = z.infer<typeof AssignDriverBody>;
export type ListOrdersInput = z.infer<typeof ListOrdersQuery>;
export type OrderIdInput = z.infer<typeof OrderIdParam>;
