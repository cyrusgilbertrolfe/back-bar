ALTER TABLE "wholesale_orders" ADD COLUMN "order_number_is_ours" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Every number we issued ourselves is a dispatch number: client prefix, "-DN",
-- five digits. CRPS-DN00001 (27 cases, 9 Oct 2026) is the only one so far.
UPDATE "wholesale_orders" SET "order_number_is_ours" = true WHERE "order_number" LIKE '%-DN_____';
