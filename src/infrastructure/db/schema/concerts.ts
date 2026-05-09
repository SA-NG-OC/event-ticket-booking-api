import {
    pgTable, uuid, varchar, text, integer, numeric,
    timestamp, pgEnum,
} from "drizzle-orm/pg-core";

export const concertStatusEnum = pgEnum("concert_status", [
    "draft",      // chưa mở bán
    "on_sale",    // đang mở bán
    "sold_out",   // hết vé
    "cancelled",  // huỷ
    "completed",  // đã diễn ra
]);

export const concerts = pgTable("concerts", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    venue: varchar("venue", { length: 255 }).notNull(),
    artistName: varchar("artist_name", { length: 255 }).notNull(),
    eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
    status: concertStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ticketTiers = pgTable("ticket_tiers", {
    id: uuid("id").primaryKey().defaultRandom(),
    concertId: uuid("concert_id").notNull().references(() => concerts.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(), // e.g. "VIP", "Standard"
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    totalQty: integer("total_qty").notNull(),
    reservedQty: integer("reserved_qty").notNull().default(0), // đã đặt (pending + confirmed)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});