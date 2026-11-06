ALTER TABLE "wholesale_orders" DROP CONSTRAINT "wholesale_orders_source_known";--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD COLUMN "waiting_on" text;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD CONSTRAINT "wholesale_orders_source_known" CHECK ("wholesale_orders"."source" in ('mailbox', 'portal', 'phone', 'in_person'));