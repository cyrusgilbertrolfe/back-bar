CREATE TYPE "public"."inbound_message_kind" AS ENUM('invoice', 'credit_note', 'quote', 'order_confirmation', 'delivery_note', 'statement', 'other');--> statement-breakpoint
CREATE TYPE "public"."invoice_line_kind" AS ENUM('goods', 'fee', 'pallet', 'epr', 'zero', 'other');--> statement-breakpoint
CREATE TYPE "public"."price_proposal_flag" AS ENUM('new', 'confirmed', 'changed', 'moved', 'pack_size_changed', 'older_than_current');--> statement-breakpoint
CREATE TYPE "public"."price_proposal_status" AS ENUM('pending', 'approved', 'rejected', 'queried');--> statement-breakpoint
CREATE TYPE "public"."supplier_invoice_status" AS ENUM('open', 'closed', 'unreadable');--> statement-breakpoint
CREATE TABLE "inbound_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"thread_id" text,
	"mailbox" text NOT NULL,
	"from_address" text NOT NULL,
	"subject" text,
	"received_at" timestamp with time zone NOT NULL,
	"kind" "inbound_message_kind" NOT NULL,
	"supplier_name" text,
	"body_text" text,
	"attachment_names" jsonb,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbound_messages_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "price_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_line_id" integer NOT NULL,
	"component_id" integer NOT NULL,
	"effective_date" date NOT NULL,
	"pack_size" numeric(12, 3) NOT NULL,
	"goods_cost" numeric(12, 4) NOT NULL,
	"fees_cost" numeric(12, 4) NOT NULL,
	"fees_note" text,
	"current_unit_cost" numeric(12, 4),
	"proposed_unit_cost" numeric(12, 4) NOT NULL,
	"change_pct" numeric(8, 2),
	"flag" "price_proposal_flag" NOT NULL,
	"urgent" boolean DEFAULT false NOT NULL,
	"status" "price_proposal_status" DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"price_history_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_proposals_invoice_line_id_unique" UNIQUE("invoice_line_id")
);
--> statement-breakpoint
CREATE TABLE "supplier_invoice_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"line_no" integer NOT NULL,
	"supplier_code" text,
	"description" text NOT NULL,
	"qty" numeric(12, 3),
	"pack_unit" text,
	"line_total" numeric(12, 2) NOT NULL,
	"kind" "invoice_line_kind" NOT NULL,
	"fee_applies_to" jsonb,
	"component_id" integer,
	"packs_per_unit" numeric(12, 3),
	"pack_size" numeric(12, 3),
	"match_note" text,
	"issue" text
);
--> statement-breakpoint
CREATE TABLE "supplier_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"inbound_message_id" integer,
	"supplier_name" text NOT NULL,
	"invoice_ref" text NOT NULL,
	"invoice_date" date NOT NULL,
	"order_ref" text,
	"attachment_name" text,
	"net_total" numeric(12, 2) NOT NULL,
	"vat" numeric(12, 2),
	"total" numeric(12, 2),
	"reconciles" boolean NOT NULL,
	"status" "supplier_invoice_status" DEFAULT 'open' NOT NULL,
	"urgent_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_item_map" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_name" text NOT NULL,
	"supplier_code" text NOT NULL,
	"description" text,
	"component_id" integer NOT NULL,
	"packs_per_unit" numeric(12, 3) NOT NULL,
	"pack_size" numeric(12, 3) NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_proposals" ADD CONSTRAINT "price_proposals_invoice_line_id_supplier_invoice_lines_id_fk" FOREIGN KEY ("invoice_line_id") REFERENCES "public"."supplier_invoice_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_proposals" ADD CONSTRAINT "price_proposals_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_proposals" ADD CONSTRAINT "price_proposals_price_history_id_component_price_history_id_fk" FOREIGN KEY ("price_history_id") REFERENCES "public"."component_price_history"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_inbound_message_id_inbound_messages_id_fk" FOREIGN KEY ("inbound_message_id") REFERENCES "public"."inbound_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_item_map" ADD CONSTRAINT "supplier_item_map_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inbound_messages_received_idx" ON "inbound_messages" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "price_proposals_status_idx" ON "price_proposals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_invoice_lines_invoice_line_uq" ON "supplier_invoice_lines" USING btree ("invoice_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_invoices_supplier_ref_uq" ON "supplier_invoices" USING btree ("supplier_name","invoice_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_item_map_supplier_code_uq" ON "supplier_item_map" USING btree ("supplier_name","supplier_code");