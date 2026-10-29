CREATE TYPE "public"."trade_buyer_status" AS ENUM('pending', 'approved', 'declined');--> statement-breakpoint
CREATE TABLE "trade_buyers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"business_name" text NOT NULL,
	"business_type" text,
	"phone" text,
	"delivery_address" text,
	"customer_id" integer,
	"status" "trade_buyer_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"last_sign_in_at" timestamp with time zone,
	CONSTRAINT "trade_buyers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "trade_login_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"buyer_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trade_login_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "short_code" text;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD COLUMN "source" text DEFAULT 'mailbox' NOT NULL;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD COLUMN "trade_buyer_id" integer;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD COLUMN "delivery_charge" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "trade_buyers" ADD CONSTRAINT "trade_buyers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_login_tokens" ADD CONSTRAINT "trade_login_tokens_buyer_id_trade_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."trade_buyers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trade_login_tokens_buyer_idx" ON "trade_login_tokens" USING btree ("buyer_id");--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD CONSTRAINT "wholesale_orders_trade_buyer_id_trade_buyers_id_fk" FOREIGN KEY ("trade_buyer_id") REFERENCES "public"."trade_buyers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wholesale_orders_trade_buyer_idx" ON "wholesale_orders" USING btree ("trade_buyer_id");--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_short_code_unique" UNIQUE("short_code");--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD CONSTRAINT "wholesale_orders_source_known" CHECK ("wholesale_orders"."source" in ('mailbox', 'portal'));--> statement-breakpoint
-- The two existing customers take the short codes already in use (20 Oct 2026 standard).
UPDATE "customers" SET "short_code" = 'CRPS' WHERE "name" LIKE 'Cripps%';--> statement-breakpoint
UPDATE "customers" SET "short_code" = 'FTNM' WHERE "name" = 'Fortnum & Mason';
