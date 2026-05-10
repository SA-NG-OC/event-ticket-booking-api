CREATE INDEX "idx_concerts_status" ON "concerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_concerts_event_date" ON "concerts" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "idx_concerts_status_event_date" ON "concerts" USING btree ("status","event_date");--> statement-breakpoint
CREATE INDEX "idx_ticket_tiers_concert_id" ON "ticket_tiers" USING btree ("concert_id");--> statement-breakpoint
CREATE INDEX "idx_vouchers_concert_id" ON "voucher_campaigns" USING btree ("concert_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_user_id" ON "bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_concert_id" ON "bookings" USING btree ("concert_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_ticket_tier_id" ON "bookings" USING btree ("ticket_tier_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_status" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bookings_flagged" ON "bookings" USING btree ("is_flagged") WHERE is_flagged = true;--> statement-breakpoint
CREATE INDEX "idx_bookings_user_status" ON "bookings" USING btree ("user_id","status");