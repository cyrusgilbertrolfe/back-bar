ALTER TABLE "wholesale_orders" ADD COLUMN "shipping_method" text;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD COLUMN "parcel_tracking" text[];--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD CONSTRAINT "wholesale_orders_shipping_method_known" CHECK ("wholesale_orders"."shipping_method" in ('pallet', 'parcel'));