import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { app } from "@/app";
import { db } from "@/infrastructure/db";
import { users } from "@/infrastructure/db/schema/users";
import { concerts, ticketTiers } from "@/infrastructure/db/schema/concerts";
import { bookings } from "@/infrastructure/db/schema/bookings";
import { voucherCampaigns } from "@/infrastructure/db/schema/vouchers";
import { v4 as uuidv4 } from "uuid";

// ── Shared state ──────────────────────────────────────────────────────────────
let customerToken: string;
let customer2Token: string;
let adminToken: string;
let customerId: string;
let customer2Id: string;

let concertId: string;
let tierId: string;
let limitedTierId: string;
let voucherCode = "TEST10";
let exhaustedCode = "MAXED";
let wrongConcertCode = "OTHERCONCERT";

// ── Global seed — chạy 1 lần cho toàn bộ file ────────────────────────────────
beforeAll(async () => {
    await db.delete(bookings);
    await db.delete(voucherCampaigns);
    await db.delete(ticketTiers);
    await db.delete(concerts);
    await db.delete(users);

    // 1. Tạo users
    const [c1Res, c2Res, aRes] = await Promise.all([
        request(app).post("/auth/register")
            .send({ email: "customer1@test.com", password: "pass1234", name: "Customer One" }),
        request(app).post("/auth/register")
            .send({ email: "customer2@test.com", password: "pass1234", name: "Customer Two" }),
        request(app).post("/auth/register")
            .send({ email: "admin@test.com", password: "pass1234", name: "Admin" }),
    ]);

    customerId = c1Res.body.data.user.id;
    customer2Id = c2Res.body.data.user.id;
    customerToken = c1Res.body.data.accessToken;
    customer2Token = c2Res.body.data.accessToken;

    // Promote admin
    await db.update(users).set({ role: "admin" }).where(eq(users.email, "admin@test.com"));
    const adminLogin = await request(app).post("/auth/login")
        .send({ email: "admin@test.com", password: "pass1234" });
    adminToken = adminLogin.body.data.accessToken;

    // 2. Tạo concert on_sale chính
    const [concertRow] = await db.insert(concerts).values({
        name: "Test Concert",
        venue: "Test Venue",
        artistName: "Test Artist",
        eventDate: new Date("2099-12-01T19:00:00Z"),
        status: "on_sale",
    }).returning();
    concertId = concertRow.id;

    // 3. Tạo concert phụ cho wrongConcertCode
    const [otherConcert] = await db.insert(concerts).values({
        name: "Other Concert",
        venue: "Other Venue",
        artistName: "Other Artist",
        eventDate: new Date("2099-11-01T19:00:00Z"),
        status: "on_sale",
    }).returning();

    // 4. Tạo ticket tiers
    const [standardRow, limitedRow] = await db.insert(ticketTiers).values([
        {
            concertId,
            name: "Standard",
            price: "1000000",
            totalQty: 100,
            reservedQty: 0,
            soldQty: 0,
        },
        {
            concertId,
            name: "Limited",
            price: "500000",
            totalQty: 1,
            reservedQty: 0,
            soldQty: 0,
        },
    ]).returning();

    tierId = standardRow.id;
    limitedTierId = limitedRow.id;

    // 5. Seed vouchers
    await db.insert(voucherCampaigns).values([
        {
            name: "10% off",
            code: voucherCode,
            discountType: "percentage",
            discountValue: "10",
            maxUses: 100,
            usedCount: 0,
            minOrderValue: "0",
        },
        {
            name: "Exhausted voucher",
            code: exhaustedCode,
            discountType: "fixed",
            discountValue: "50000",
            maxUses: 1,
            usedCount: 1,
            minOrderValue: "0",
        },
        {
            name: "Other concert voucher",
            code: wrongConcertCode,
            discountType: "fixed",
            discountValue: "50000",
            maxUses: 100,
            usedCount: 0,
            minOrderValue: "0",
            concertId: otherConcert.id, // ✅ FK hợp lệ
        },
    ]);
});

// Reset bookings trước mỗi test để isolate
beforeEach(async () => {
    await db.delete(bookings);
    await db.update(ticketTiers).set({ reservedQty: 0, soldQty: 0 });
    await db.update(voucherCampaigns)
        .set({ usedCount: 0 })
        .where(eq(voucherCampaigns.code, voucherCode));
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeBookingPayload(overrides: Record<string, unknown> = {}) {
    return {
        ticketTierId: tierId,
        quantity: 1,
        idempotencyKey: uuidv4(),
        ...overrides,
    };
}

async function createBooking(token = customerToken, overrides = {}) {
    return request(app)
        .post("/bookings")
        .set("Authorization", `Bearer ${token}`)
        .send(makeBookingPayload(overrides));
}

async function getTierReserved(id: string) {
    const row = await db.query.ticketTiers.findFirst({ where: eq(ticketTiers.id, id) });
    return row?.reservedQty ?? 0;
}

// ═════════════════════════════════════════════════════════════════════════════
// CREATE BOOKING
// ═════════════════════════════════════════════════════════════════════════════
describe("POST /bookings", () => {
    it("creates booking successfully and reservedQty is incremented", async () => {
        const res = await createBooking();

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe("pending");
        expect(res.body.data.userId).toBe(customerId);
        expect(res.body.data.concertId).toBe(concertId);
        expect(res.body.data.unitPrice).toBe(1000000);
        expect(res.body.data.totalAmount).toBe(1000000);
        expect(res.body.data.discountAmount).toBe(0);
        expect(res.body.data.finalAmount).toBe(1000000);

        expect(await getTierReserved(tierId)).toBe(1);
    });

    it("applies voucher and calculates discount correctly", async () => {
        const res = await createBooking(customerToken, { voucherCode });

        expect(res.status).toBe(201);
        expect(res.body.data.voucherCode).toBe(voucherCode);
        expect(res.body.data.discountAmount).toBe(100000);
        expect(res.body.data.finalAmount).toBe(900000);

        const vc = await db.query.voucherCampaigns.findFirst({
            where: eq(voucherCampaigns.code, voucherCode),
        });
        expect(vc?.usedCount).toBe(1);
    });

    it("applies voucher for quantity > 1 correctly", async () => {
        const res = await createBooking(customerToken, { quantity: 3, voucherCode });

        expect(res.status).toBe(201);
        expect(res.body.data.totalAmount).toBe(3000000);
        expect(res.body.data.discountAmount).toBe(300000);
        expect(res.body.data.finalAmount).toBe(2700000);
        expect(await getTierReserved(tierId)).toBe(3);
    });

    // ── Idempotency ────────────────────────────────────────────────────────────
    it("returns same booking on duplicate idempotencyKey (retry safety)", async () => {
        const key = uuidv4();
        const first = await createBooking(customerToken, { idempotencyKey: key });
        const second = await createBooking(customerToken, { idempotencyKey: key });

        expect(first.status).toBe(201);
        expect(second.status).toBe(201);
        expect(second.body.data.id).toBe(first.body.data.id);

        expect(await getTierReserved(tierId)).toBe(1);
    });

    // ── Oversell protection ───────────────────────────────────────────────────
    it("rejects booking when not enough tickets", async () => {
        const res = await createBooking(customerToken, {
            ticketTierId: limitedTierId,
            quantity: 2,
        });

        expect(res.status).toBe(409);
        expect(res.body.type).toBe("CONFLICT");
        expect(res.body.message).toMatch(/Not enough tickets/);
    });

    it("prevents oversell under concurrent requests (serial simulation)", async () => {
        const keys = [uuidv4(), uuidv4(), uuidv4()];
        const results = await Promise.all(
            keys.map(k => createBooking(customerToken, { ticketTierId: limitedTierId, idempotencyKey: k }))
        );

        const successes = results.filter(r => r.status === 201);
        const conflicts = results.filter(r => r.status === 409);

        expect(successes).toHaveLength(1);
        expect(conflicts).toHaveLength(2);
        expect(await getTierReserved(limitedTierId)).toBe(1);
    });

    // ── Voucher validation ─────────────────────────────────────────────────────
    it("rejects exhausted voucher", async () => {
        const res = await createBooking(customerToken, { voucherCode: exhaustedCode });

        expect(res.status).toBe(422);
        expect(res.body.message).toMatch(/maximum usage limit/);
    });

    it("rejects voucher for wrong concert", async () => {
        const res = await createBooking(customerToken, { voucherCode: wrongConcertCode });

        expect(res.status).toBe(422);
        expect(res.body.message).toMatch(/not valid for this concert/);
    });

    it("rejects same voucher used twice by same user", async () => {
        await createBooking(customerToken, { voucherCode });

        const res = await createBooking(customerToken, { voucherCode });
        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/already used this voucher/);

        const res2 = await createBooking(customer2Token, { voucherCode });
        expect(res2.status).toBe(201);
    });

    it("rejects non-existent voucher code", async () => {
        const res = await createBooking(customerToken, { voucherCode: "DOES_NOT_EXIST" });
        expect(res.status).toBe(404);
    });

    // ── Concert state validation ───────────────────────────────────────────────
    it("rejects booking for non-on_sale concert", async () => {
        const [draftConcert] = await db.insert(concerts).values({
            name: "Draft Concert",
            venue: "Venue",
            artistName: "Artist",
            eventDate: new Date("2099-11-01T19:00:00Z"),
            status: "draft",
        }).returning();

        const [draftTier] = await db.insert(ticketTiers).values({
            concertId: draftConcert.id,
            name: "Standard",
            price: "500000",
            totalQty: 100,
            reservedQty: 0,
            soldQty: 0,
        }).returning();

        const res = await createBooking(customerToken, { ticketTierId: draftTier.id });
        expect(res.status).toBe(422);
        expect(res.body.message).toMatch(/not accepting bookings/);

        await db.delete(ticketTiers).where(eq(ticketTiers.id, draftTier.id));
        await db.delete(concerts).where(eq(concerts.id, draftConcert.id));
    });

    // ── Input validation ──────────────────────────────────────────────────────
    it("rejects quantity = 0", async () => {
        const res = await createBooking(customerToken, { quantity: 0 });
        expect(res.status).toBe(400);
    });

    it("rejects quantity > 10", async () => {
        const res = await createBooking(customerToken, { quantity: 11 });
        expect(res.status).toBe(400);
    });

    it("rejects invalid ticketTierId format", async () => {
        const res = await createBooking(customerToken, { ticketTierId: "not-a-uuid" });
        expect(res.status).toBe(400);
    });

    it("rejects missing idempotencyKey", async () => {
        const res = await request(app)
            .post("/bookings")
            .set("Authorization", `Bearer ${customerToken}`)
            .send({ ticketTierId: tierId, quantity: 1 });
        expect(res.status).toBe(400);
    });

    it("rejects unauthenticated request", async () => {
        const res = await request(app).post("/bookings").send(makeBookingPayload());
        expect(res.status).toBe(401);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET MY BOOKINGS
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /bookings/my", () => {
    it("returns only current user's bookings", async () => {
        await createBooking(customerToken);
        await createBooking(customerToken);
        await createBooking(customer2Token);

        const res = await request(app)
            .get("/bookings/my")
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.total).toBe(2);
        expect(res.body.data.bookings.every((b: any) => b.userId === customerId)).toBe(true);
    });

    it("returns empty list when no bookings", async () => {
        const res = await request(app)
            .get("/bookings/my")
            .set("Authorization", `Bearer ${customerToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.total).toBe(0);
    });

    it("respects pagination", async () => {
        for (let i = 0; i < 3; i++) {
            await createBooking(customerToken);
        }
        const res = await request(app)
            .get("/bookings/my?page=1&limit=2")
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.bookings).toHaveLength(2);
        expect(res.body.data.total).toBe(3);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET BOOKING BY ID
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /bookings/:id", () => {
    it("customer can view own booking", async () => {
        const created = await createBooking(customerToken);
        const res = await request(app)
            .get(`/bookings/${created.body.data.id}`)
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(created.body.data.id);
    });

    it("customer cannot view another user's booking", async () => {
        const created = await createBooking(customer2Token);
        const res = await request(app)
            .get(`/bookings/${created.body.data.id}`)
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(403);
    });

    it("admin can view any booking", async () => {
        const created = await createBooking(customerToken);
        const res = await request(app)
            .get(`/bookings/${created.body.data.id}`)
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
    });

    it("returns 404 for non-existent booking", async () => {
        const res = await request(app)
            .get(`/bookings/${uuidv4()}`)
            .set("Authorization", `Bearer ${customerToken}`);
        expect(res.status).toBe(404);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// CANCEL MY BOOKING
// ═════════════════════════════════════════════════════════════════════════════
describe("PATCH /bookings/:id/cancel", () => {
    it("customer can cancel their own pending booking", async () => {
        const created = await createBooking(customerToken);
        const res = await request(app)
            .patch(`/bookings/${created.body.data.id}/cancel`)
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe("cancelled");
    });

    it("cancelling pending booking does NOT release reserved qty (payment not yet confirmed)", async () => {
        const created = await createBooking(customerToken);
        const reservedBefore = await getTierReserved(tierId);

        await request(app)
            .patch(`/bookings/${created.body.data.id}/cancel`)
            .set("Authorization", `Bearer ${customerToken}`);

        const reservedAfter = await getTierReserved(tierId);
        expect(reservedAfter).toBe(reservedBefore);
    });

    it("cancelling confirmed booking DOES release reserved qty", async () => {
        const created = await createBooking(customerToken);

        await db.update(bookings)
            .set({ status: "confirmed" })
            .where(eq(bookings.id, created.body.data.id));

        await db.update(ticketTiers)
            .set({ reservedQty: 0, soldQty: 1 })
            .where(eq(ticketTiers.id, tierId));

        await request(app)
            .patch(`/bookings/${created.body.data.id}/cancel`)
            .set("Authorization", `Bearer ${customerToken}`);

        const tier = await db.query.ticketTiers.findFirst({ where: eq(ticketTiers.id, tierId) });
        expect(tier?.soldQty).toBe(0);
        expect(tier?.reservedQty).toBe(0);
    });

    it("customer cannot cancel another user's booking", async () => {
        const created = await createBooking(customer2Token);
        const res = await request(app)
            .patch(`/bookings/${created.body.data.id}/cancel`)
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(403);
    });

    it("cannot cancel an already cancelled booking", async () => {
        const created = await createBooking(customerToken);
        await request(app)
            .patch(`/bookings/${created.body.data.id}/cancel`)
            .set("Authorization", `Bearer ${customerToken}`);

        const res = await request(app)
            .patch(`/bookings/${created.body.data.id}/cancel`)
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(422);
        expect(res.body.type).toBe("BUSINESS_RULE");
    });

    it("cannot cancel a failed booking", async () => {
        const created = await createBooking(customerToken);
        await db.update(bookings).set({ status: "failed" })
            .where(eq(bookings.id, created.body.data.id));

        const res = await request(app)
            .patch(`/bookings/${created.body.data.id}/cancel`)
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(422);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// OPS: LIST ALL BOOKINGS
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /bookings (admin)", () => {
    it("admin can list all bookings", async () => {
        await createBooking(customerToken);
        await createBooking(customer2Token);

        const res = await request(app)
            .get("/bookings")
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.total).toBe(2);
    });

    it("customer cannot access ops list endpoint", async () => {
        const res = await request(app)
            .get("/bookings")
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(403);
    });

    it("filters by status", async () => {
        const b = await createBooking(customerToken);
        await db.update(bookings).set({ status: "confirmed" }).where(eq(bookings.id, b.body.data.id));
        await createBooking(customer2Token);

        const res = await request(app)
            .get("/bookings?status=confirmed")
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.total).toBe(1);
        expect(res.body.data.bookings[0].status).toBe("confirmed");
    });

    it("filters by isFlagged=true", async () => {
        const b1 = await createBooking(customerToken);
        await createBooking(customer2Token);

        await db.update(bookings)
            .set({ isFlagged: true, flagReason: "Suspicious" })
            .where(eq(bookings.id, b1.body.data.id));

        const res = await request(app)
            .get("/bookings?isFlagged=true")
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.total).toBe(1);
        expect(res.body.data.bookings[0].isFlagged).toBe(true);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// OPS: UPDATE BOOKING STATUS
// ═════════════════════════════════════════════════════════════════════════════
describe("PATCH /bookings/:id/status (admin)", () => {
    it("admin can confirm a pending booking", async () => {
        const created = await createBooking(customerToken);
        const res = await request(app)
            .patch(`/bookings/${created.body.data.id}/status`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ status: "confirmed" });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe("confirmed");
    });

    it("admin can cancel a confirmed booking and reservedQty is released", async () => {
        const created = await createBooking(customerToken);
        await db.update(bookings).set({ status: "confirmed" })
            .where(eq(bookings.id, created.body.data.id));

        await db.update(ticketTiers)
            .set({ reservedQty: 0, soldQty: 1 })
            .where(eq(ticketTiers.id, tierId));

        const res = await request(app)
            .patch(`/bookings/${created.body.data.id}/status`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ status: "cancelled" });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe("cancelled");
        const tier = await db.query.ticketTiers.findFirst({ where: eq(ticketTiers.id, tierId) });
        expect(tier?.soldQty).toBe(0);
        expect(tier?.reservedQty).toBe(0);
    });

    it("rejects invalid transition: confirmed → confirmed", async () => {
        const created = await createBooking(customerToken);
        await db.update(bookings).set({ status: "confirmed" })
            .where(eq(bookings.id, created.body.data.id));

        const res = await request(app)
            .patch(`/bookings/${created.body.data.id}/status`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ status: "confirmed" });

        expect(res.status).toBe(422);
        expect(res.body.type).toBe("BUSINESS_RULE");
    });

    it("rejects invalid transition: cancelled → confirmed", async () => {
        const created = await createBooking(customerToken);
        await db.update(bookings).set({ status: "cancelled" })
            .where(eq(bookings.id, created.body.data.id));

        const res = await request(app)
            .patch(`/bookings/${created.body.data.id}/status`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ status: "confirmed" });

        expect(res.status).toBe(422);
    });

    it("rejects invalid status value", async () => {
        const created = await createBooking(customerToken);
        const res = await request(app)
            .patch(`/bookings/${created.body.data.id}/status`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ status: "pending" });

        expect(res.status).toBe(400);
    });

    it("customer cannot update status", async () => {
        const created = await createBooking(customerToken);
        const res = await request(app)
            .patch(`/bookings/${created.body.data.id}/status`)
            .set("Authorization", `Bearer ${customerToken}`)
            .send({ status: "confirmed" });

        expect(res.status).toBe(403);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// OPS: FLAG / UNFLAG
// ═════════════════════════════════════════════════════════════════════════════
describe("PATCH /bookings/:id/flag + unflag (admin)", () => {
    it("admin can flag a booking with reason", async () => {
        const created = await createBooking(customerToken);
        const res = await request(app)
            .patch(`/bookings/${created.body.data.id}/flag`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ reason: "Suspected bot activity" });

        expect(res.status).toBe(200);
        expect(res.body.data.isFlagged).toBe(true);
        expect(res.body.data.flagReason).toBe("Suspected bot activity");
    });

    it("admin can unflag a booking", async () => {
        const created = await createBooking(customerToken);
        await request(app)
            .patch(`/bookings/${created.body.data.id}/flag`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ reason: "Test" });

        const res = await request(app)
            .patch(`/bookings/${created.body.data.id}/unflag`)
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.isFlagged).toBe(false);
        expect(res.body.data.flagReason).toBeNull();
    });

    it("rejects flag with empty reason", async () => {
        const created = await createBooking(customerToken);
        const res = await request(app)
            .patch(`/bookings/${created.body.data.id}/flag`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ reason: "" });

        expect(res.status).toBe(400);
    });

    it("customer cannot flag bookings", async () => {
        const created = await createBooking(customerToken);
        const res = await request(app)
            .patch(`/bookings/${created.body.data.id}/flag`)
            .set("Authorization", `Bearer ${customerToken}`)
            .send({ reason: "test" });

        expect(res.status).toBe(403);
    });
});