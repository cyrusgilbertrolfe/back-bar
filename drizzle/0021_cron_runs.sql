CREATE TABLE "cron_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ok" boolean NOT NULL,
	"checked" integer,
	"written" integer,
	"error" text
);
--> statement-breakpoint
CREATE INDEX "cron_runs_job_ran_at_idx" ON "cron_runs" USING btree ("job","ran_at");