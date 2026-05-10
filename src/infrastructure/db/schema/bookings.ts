import { pgTable, uuid, varchar, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { concerts, ticketTiers } from "./concerts";
import { boolean } from "drizzle-orm/pg-core";
import { text } from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";
import { index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const bookingStatusEnum = pgEnum("booking_status", [
    "pending",    // vừa tạo, chờ thanh toán
    "confirmed",  // đã thanh toán thành công
    "cancelled",  // đã huỷ
    "failed",     // thanh toán thất bại
]);

export const bookings = pgTable("bookings", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    ticketTierId: uuid("ticket_tier_id").notNull().references(() => ticketTiers.id),
    concertId: uuid("concert_id").notNull().references(() => concerts.id),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    finalAmount: numeric("final_amount", { precision: 12, scale: 2 }).notNull(),
    voucherCode: varchar("voucher_code", { length: 50 }),
    status: bookingStatusEnum("status").notNull().default("pending"),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).unique(),
    // Ops flags
    isFlagged: boolean("is_flagged").notNull().default(false),
    flagReason: text("flag_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
    index("idx_bookings_user_id").on(t.userId),
    index("idx_bookings_concert_id").on(t.concertId),
    index("idx_bookings_ticket_tier_id").on(t.ticketTierId),
    index("idx_bookings_status").on(t.status),
    index("idx_bookings_flagged").on(t.isFlagged).where(sql`is_flagged = true`),
    index("idx_bookings_user_status").on(t.userId, t.status),
]);


export type BookingRow = typeof bookings.$inferSelect;
export type NewBookingRow = typeof bookings.$inferInsert;