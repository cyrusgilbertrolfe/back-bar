ALTER TABLE "wholesale_orders" ADD COLUMN "planned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD COLUMN "price_note" text;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD COLUMN "confirmation_sent_on" date;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD COLUMN "customer_needs" text;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD COLUMN "customer_needs_met_on" date;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD COLUMN "production_on" date;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD COLUMN "packing_on" date;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD COLUMN "pallet_build_on" date;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD COLUMN "carrier" text;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD COLUMN "carrier_booked_on" date;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD COLUMN "collection_on" date;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD COLUMN "pallet_packed_on" date;