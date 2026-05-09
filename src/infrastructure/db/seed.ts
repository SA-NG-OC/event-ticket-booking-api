import "dotenv/config";
import { db } from "./index";
import {
    concerts, ticketTiers, voucherCampaigns,
} from "./schema";

async function seed() {
    console.log("Seeding database...");

    // ── Concerts ────────────────────────────────────────────────────────────────
    const [concert1, concert2] = await db
        .insert(concerts)
        .values([
            {
                name: "Sơn Tùng M-TP Live Concert 2025",
                description: "Đêm nhạc đặc biệt của Sơn Tùng M-TP tại TP.HCM",
                venue: "Sân vận động Mỹ Đình, Hà Nội",
                artistName: "Sơn Tùng M-TP",
                eventDate: new Date("2025-12-20T19:00:00+07:00"),
                status: "on_sale",
            },
            {
                name: "Blackpink World Tour - Ho Chi Minh",
                description: "Blackpink Born Pink World Tour",
                venue: "Nhà thi đấu Phú Thọ, TP.HCM",
                artistName: "Blackpink",
                eventDate: new Date("2025-11-15T18:30:00+07:00"),
                status: "on_sale",
            },
        ])
        .returning();

    // ── Ticket Tiers ────────────────────────────────────────────────────────────
    await db.insert(ticketTiers).values([
        // Concert 1
        { concertId: concert1.id, name: "VIP", price: "3500000", totalQty: 200 },
        { concertId: concert1.id, name: "Standard", price: "1500000", totalQty: 2000 },
        { concertId: concert1.id, name: "Economy", price: "800000", totalQty: 5000 },
        // Concert 2
        { concertId: concert2.id, name: "VIP", price: "5000000", totalQty: 150 },
        { concertId: concert2.id, name: "Standard", price: "2000000", totalQty: 3000 },
    ]);

    // ── Voucher Campaigns ────────────────────────────────────────────────────────
    await db.insert(voucherCampaigns).values([
        {
            name: "Flash Sale Opening",
            code: "FLASHSALE10",
            discountType: "percentage",
            discountValue: "10",    // 10%
            maxUses: 500,
            minOrderValue: "500000",
            expiresAt: new Date("2025-12-31T23:59:59+07:00"),
        },
        {
            name: "VIP Discount",
            code: "VIP200K",
            discountType: "fixed",
            discountValue: "200000",  // giảm 200k
            maxUses: 100,
            minOrderValue: "2000000",
            concertId: concert1.id, // chỉ áp dụng cho concert 1
            expiresAt: new Date("2025-12-31T23:59:59+07:00"),
        },
        {
            name: "Welcome Voucher",
            code: "WELCOME50K",
            discountType: "fixed",
            discountValue: "50000",
            maxUses: 1000,
            minOrderValue: "0",
        },
    ]);

    console.log("Seed complete!");
    process.exit(0);
}

seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});