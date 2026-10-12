-- PostGIS setup for GeoDelivery API
-- Not managed by Prisma because Prisma cannot express GEOGRAPHY type.
-- Run AFTER `npx prisma migrate dev` creates the base tables:
--
--   docker exec -i geodelivery-postgres psql -U user -d geodelivery < prisma/sql/postgis_setup.sql

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE "restaurants"
  ADD COLUMN IF NOT EXISTS "location" geography(Point, 4326);

ALTER TABLE "drivers"
  ADD COLUMN IF NOT EXISTS "location" geography(Point, 4326);

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "customer_location" geography(Point, 4326);

CREATE INDEX IF NOT EXISTS "restaurants_location_gist_idx"
  ON "restaurants" USING GIST ("location");

CREATE INDEX IF NOT EXISTS "drivers_location_gist_idx"
  ON "drivers" USING GIST ("location");

CREATE INDEX IF NOT EXISTS "orders_customer_location_gist_idx"
  ON "orders" USING GIST ("customer_location");