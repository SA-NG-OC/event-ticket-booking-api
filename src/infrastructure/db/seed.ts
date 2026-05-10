import { users } from "./schema/users";
import { concerts, ticketTiers } from "./schema/concerts";
import { bookings } from "./schema/bookings";
import { voucherCampaigns } from "./schema/vouchers";
import { db } from ".";

// ─── Fixed IDs ──────────────────────────────────────────────────────────────
const ID = {
    users: {
        customer: "32d5278e-fe3e-486a-b33c-61eed25b0f3b",
        admin: "1bc6bab8-8651-4612-99d5-3b2fecdca9fc",
    },
    concerts: {
        c1: "4aa6ebbf-4aa8-4f1d-9568-10e03e5ee77b",
        c2: "e2e3f4d1-d6e3-4c78-9513-76d7afedd999",
        draft: "e3420f72-4674-49a9-ae9c-56d63128c502",
    },
    tiers: {
        c1Standard: "1b535b96-b52c-47dd-9181-9724fea233a8",
        c1Vip: "4228d316-23f9-46dd-9cad-6d17e4f294a5",
        c2Standard: "1d60baa1-99fa-4f39-849d-b5cf37e870c0",
        c2Vip: "e2326d86-3cfe-43dd-9ad1-a02091718556",
        draftStandard: "d94a8630-dbfe-45e3-b4ae-55b7f258bfd0",
    },
    vouchers: {
        global: "72e91ee4-7c03-4e22-8e15-96d66e783778",
        concert1: "82952006-64ea-4513-b543-353d37fcae91",
    },
    bookings: {
        b1: "4af5b4dd-44a0-49e7-863c-a7f6467adccc",
        b2: "7c4b048d-b367-481b-a1f6-366c125f1548",
        b3: "37d07444-21ef-4301-a81c-b773ab6b9a79",
    },
} as const;

async function seed() {
    console.log("🌱 Starting seed...");

    // ─── 1. Xóa dữ liệu cũ (đúng thứ tự FK) ───────────────────────────────────
    console.log("🗑️  Clearing old data...");
    await db.delete(bookings);
    await db.delete(voucherCampaigns);
    await db.delete(ticketTiers);
    await db.delete(concerts);
    await db.delete(users);
    console.log("✅ Old data cleared.");

    // ─── 2. Users ───────────────────────────────────────────────────────────────
    console.log("👤 Seeding users...");
    const PASSWORD_HASH = "$2b$10$q6xlmXndQpMoZKEf8Ibz9OfLtoTfBZuJZsIBkkw8TS/VoEmBfiFjS";

    const [customer, admin] = await db
        .insert(users)
        .values([
            {
                id: ID.users.customer,
                email: "test@gmail.com",
                passwordHash: PASSWORD_HASH,
                name: "Test Customer",
                role: "customer",
            },
            {
                id: ID.users.admin,
                email: "admin@gmail.com",
                passwordHash: PASSWORD_HASH,
                name: "Admin User",
                role: "admin",
            },
        ])
        .returning();

    console.log(`  ✔ Created user: ${customer.email} (${customer.role}) → ${customer.id}`);
    console.log(`  ✔ Created user: ${admin.email} (${admin.role}) → ${admin.id}`);

    // ─── 3. Concerts ────────────────────────────────────────────────────────────
    console.log("🎵 Seeding concerts...");

    const [concert1, concert2, concertDraft] = await db
        .insert(concerts)
        .values([
            {
                id: ID.concerts.c1,
                name: "Sơn Tùng MTP – Sky Tour 2025",
                description: "Đêm nhạc hoành tráng của Sơn Tùng MTP với sân khấu 360° lần đầu tiên tại Việt Nam.",
                venue: "Sân vận động Mỹ Đình, Hà Nội",
                artistName: "Sơn Tùng MTP",
                eventDate: new Date("2025-08-15T19:00:00+07:00"),
                status: "on_sale",
            },
            {
                id: ID.concerts.c2,
                name: "Hà Anh Tuấn – Portrait of Love",
                description: "Hành trình âm nhạc đặc biệt kỷ niệm 15 năm ca hát của Hà Anh Tuấn.",
                venue: "Nhà hát Hòa Bình, TP. Hồ Chí Minh",
                artistName: "Hà Anh Tuấn",
                eventDate: new Date("2025-09-20T20:00:00+07:00"),
                status: "on_sale",
            },
            {
                id: ID.concerts.draft,
                name: "MONO – Còn Lại Gì Không Tour",
                description: "Concert đang trong giai đoạn lên kế hoạch, chưa mở bán.",
                venue: "Trung tâm Hội nghị Quốc gia, Hà Nội",
                artistName: "MONO",
                eventDate: new Date("2025-12-31T20:00:00+07:00"),
                status: "draft",
            },
        ])
        .returning();

    console.log(`  ✔ Created concert: ${concert1.name} → ${concert1.id}`);
    console.log(`  ✔ Created concert: ${concert2.name} → ${concert2.id}`);
    console.log(`  ✔ Created concert: ${concertDraft.name} → ${concertDraft.id}`);

    // ─── 4. Ticket Tiers ────────────────────────────────────────────────────────
    console.log("🎟️  Seeding ticket tiers...");

    const [tierC1Standard, tierC1Vip, tierC2Standard, tierC2Vip, tierDraftStandard] = await db
        .insert(ticketTiers)
        .values([
            {
                id: ID.tiers.c1Standard,
                concertId: ID.concerts.c1,
                name: "Standard",
                price: "850000",
                totalQty: 5000,
                reservedQty: 0,
                soldQty: 0,
            },
            {
                id: ID.tiers.c1Vip,
                concertId: ID.concerts.c1,
                name: "VIP",
                price: "2500000",
                totalQty: 500,
                reservedQty: 0,
                soldQty: 0,
            },
            {
                id: ID.tiers.c2Standard,
                concertId: ID.concerts.c2,
                name: "Standard",
                price: "650000",
                totalQty: 3000,
                reservedQty: 0,
                soldQty: 0,
            },
            {
                id: ID.tiers.c2Vip,
                concertId: ID.concerts.c2,
                name: "VIP",
                price: "1800000",
                totalQty: 300,
                reservedQty: 0,
                soldQty: 0,
            },
            {
                id: ID.tiers.draftStandard,
                concertId: ID.concerts.draft,
                name: "Standard",
                price: "750000",
                totalQty: 2000,
                reservedQty: 0,
                soldQty: 0,
            },
        ])
        .returning();

    console.log(`  ✔ Tier: ${concert1.name} – ${tierC1Standard.name} → ${tierC1Standard.id}`);
    console.log(`  ✔ Tier: ${concert1.name} – ${tierC1Vip.name} → ${tierC1Vip.id}`);
    console.log(`  ✔ Tier: ${concert2.name} – ${tierC2Standard.name} → ${tierC2Standard.id}`);
    console.log(`  ✔ Tier: ${concert2.name} – ${tierC2Vip.name} → ${tierC2Vip.id}`);
    console.log(`  ✔ Tier: ${concertDraft.name} – ${tierDraftStandard.name} → ${tierDraftStandard.id}`);

    // ─── 5. Voucher Campaigns ───────────────────────────────────────────────────
    console.log("🏷️  Seeding voucher campaigns...");

    const [voucherGlobal, voucherConcert1] = await db
        .insert(voucherCampaigns)
        .values([
            {
                id: ID.vouchers.global,
                name: "Chào hè 2025 – Giảm 10%",
                code: "SUMMER10",
                discountType: "percentage",
                discountValue: "10",
                maxUses: 1000,
                usedCount: 0,
                minOrderValue: "500000",
                expiresAt: new Date("2026-08-31T23:59:59+07:00"),
                concertId: null,
            },
            {
                id: ID.vouchers.concert1,
                name: "Sky Tour – Ưu đãi 200k",
                code: "SKYTOUR200",
                discountType: "fixed",
                discountValue: "200000",
                maxUses: 200,
                usedCount: 0,
                minOrderValue: "1000000",
                expiresAt: new Date("2026-08-14T23:59:59+07:00"),
                concertId: ID.concerts.c1,
            },
        ])
        .returning();

    console.log(`  ✔ Voucher: ${voucherGlobal.code} → ${voucherGlobal.id}`);
    console.log(`  ✔ Voucher: ${voucherConcert1.code} → ${voucherConcert1.id}`);

    // ─── 6. Bookings ────────────────────────────────────────────────────────────
    console.log("📋 Seeding bookings...");

    const unitPrice1 = 850000;
    const qty1 = 2;
    const totalAmount1 = unitPrice1 * qty1;        // 1_700_000
    const discount1 = totalAmount1 * 0.1;       //   170_000
    const final1 = totalAmount1 - discount1; // 1_530_000

    const unitPrice2 = 1800000;
    const qty2 = 1;
    const totalAmount2 = unitPrice2 * qty2;
    const discount2 = 0;
    const final2 = totalAmount2 - discount2;

    const [booking1, booking2, booking3] = await db
        .insert(bookings)
        .values([
            {
                id: ID.bookings.b1,
                userId: ID.users.customer,
                ticketTierId: ID.tiers.c1Standard,
                concertId: ID.concerts.c1,
                quantity: qty1,
                unitPrice: String(unitPrice1),
                totalAmount: String(totalAmount1),
                discountAmount: String(discount1),
                finalAmount: String(final1),
                voucherCode: "SUMMER10",
                status: "confirmed",
                idempotencyKey: "seed-booking-001",
                isFlagged: false,
            },
            {
                id: ID.bookings.b2,
                userId: ID.users.customer,
                ticketTierId: ID.tiers.c2Vip,
                concertId: ID.concerts.c2,
                quantity: qty2,
                unitPrice: String(unitPrice2),
                totalAmount: String(totalAmount2),
                discountAmount: String(discount2),
                finalAmount: String(final2),
                voucherCode: null,
                status: "pending",
                idempotencyKey: "seed-booking-002",
                isFlagged: false,
            },
            {
                id: ID.bookings.b3,
                userId: ID.users.customer,
                ticketTierId: ID.tiers.c1Vip,
                concertId: ID.concerts.c1,
                quantity: 1,
                unitPrice: "2500000",
                totalAmount: "2500000",
                discountAmount: "0",
                finalAmount: "2500000",
                voucherCode: null,
                status: "pending",
                idempotencyKey: "seed-booking-003",
                isFlagged: false,
            },
        ])
        .returning();

    console.log(`  ✔ Booking: ${booking1.id} (${booking1.status}, ${booking1.finalAmount} VND)`);
    console.log(`  ✔ Booking: ${booking2.id} (${booking2.status}, ${booking2.finalAmount} VND)`);
    console.log(`  ✔ Booking: ${booking3.id} (${booking3.status}, ${booking3.finalAmount} VND)`);

    console.log("\n🎉 Seed completed successfully!");
}

seed().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});