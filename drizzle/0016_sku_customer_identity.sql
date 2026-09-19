ALTER TABLE "skus" ADD COLUMN "short_code" text;--> statement-breakpoint
ALTER TABLE "skus" ADD COLUMN "customer_item_code" text;--> statement-breakpoint
ALTER TABLE "skus" ADD COLUMN "customer_description" text;--> statement-breakpoint
ALTER TABLE "skus" ADD COLUMN "units_per_case" integer;--> statement-breakpoint
ALTER TABLE "skus" ADD CONSTRAINT "skus_short_code_unique" UNIQUE("short_code");