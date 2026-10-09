ALTER TABLE "component_price_history" ADD COLUMN "goods_cost" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "component_price_history" ADD COLUMN "fees_cost" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "component_price_history" ADD COLUMN "fees_note" text;