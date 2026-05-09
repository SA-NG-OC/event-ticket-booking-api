import {
    pgTable, uuid, varchar, text, integer, numeric,
    timestamp, pgEnum,
} from "drizzle-orm/pg-core";
import { concerts } from "./concerts";

export const discountTypeEnum = pgEnum("discount_type", ["percentage", "fixed"]);

export const voucherCampaigns = pgTable("voucher_campaigns", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    discountType: discountTypeEnum("discount_type").notNull(),
    discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
    maxUses: integer("max_uses").notNull(),
    usedCount: integer("used_count").notNull().default(0),
    minOrderValue: numeric("min_order_value", { precision: 12, scale: 2 }).default("0"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    concertId: uuid("concert_id").references(() => concerts.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});