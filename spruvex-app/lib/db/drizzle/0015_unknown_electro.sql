ALTER TABLE "registration_otps" DROP CONSTRAINT "registration_otps_email_unique";--> statement-breakpoint
ALTER TABLE "registration_otps" ADD COLUMN "purpose" text DEFAULT 'registration' NOT NULL;--> statement-breakpoint
ALTER TABLE "registration_otps" ADD CONSTRAINT "registration_otps_email_purpose_unique" UNIQUE("email","purpose");