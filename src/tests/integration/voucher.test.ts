import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { app } from "@/app";
import { db } from "@/infrastructure/db";
import { users } from "@/infrastructure/db/schema/users";
import { concerts, ticketTiers } from "@/infrastructure/db/schema/concerts";
import { voucherCampaigns } from "@/infrastructure/db/schema/vouchers";
import { bookings } from "@/infrastructure/db/schema";

let adminToken: string;
let customerToken: string;
let concertId: string;
let otherConcertId: string;

// ── Global seed ───────────────────────────────────────────────────────────────
beforeAll(async () => {
    await db.delete(bookings);
    await db.delete(voucherCampaigns);
    await db.delete(concerts);
    await db.delete(users);

    // Users
    const [aReg, cReg] = await Promise.all([
        request(app).post("/auth/register")
            .send({ email: "admin@v.test", password: "pass1234", name: "Admin" }),
        request(app).post("/auth/register")
            .send({ email: "cust@v.test", password: "pass1234", name: "Customer" }),
    ]);
    customerToken = cReg.body.data.accessToken;

    await db.update(users).set({ role: "admin" }).where(eq(users.email, "admin@v.test"));
    const aLogin = await request(app).post("/auth/login")
        .send({ email: "admin@v.test", password: "pass1234" });
    adminToken = aLogin.body.data.accessToken;

    // Concerts
    const [c1, c2] = await db.insert(concerts).values([
        { name: "Concert A", venue: "Venue A", artistName: "Artist A", eventDate: new Date("2099-10-01T19:00:00Z"), status: "on_sale" },
        { name: "Concert B", venue: "Venue B", artistName: "Artist B", eventDate: new Date("2099-11-01T19:00:00Z"), status: "on_sale" },
    ]).returning();
    concertId = c1.id;
    otherConcertId = c2.id;
});

afterAll(async () => {
    await db.delete(bookings);
    await db.delete(ticketTiers);
    await db.delete(voucherCampaigns);
    await db.delete(concerts);
    await db.delete(users);
});

beforeEach(async () => {
    await db.delete(voucherCampaigns);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeVoucher(overrides: Record<string, unknown> = {}) {
    return {
        name: "Test Voucher",
        code: "TESTVOUCHER10",
        discountType: "percentage",
        discountValue: 10,
        maxUses: 100,
        minOrderValue: 0,
        ...overrides,
    };
}

async function createVoucher(overrides = {}) {
    return request(app)
        .post("/vouchers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(makeVoucher(overrides));
}

// ═════════════════════════════════════════════════════════════════════════════
// CREATE VOUCHER
// ═════════════════════════════════════════════════════════════════════════════
describe("POST /vouchers (admin)", () => {
    it("creates a percentage voucher successfully", async () => {
        const res = await createVoucher();

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.code).toBe("TESTVOUCHER10");
        expect(res.body.data.discountType).toBe("percentage");
        expect(res.body.data.discountValue).toBe(10);
        expect(res.body.data.usedCount).toBe(0);
        expect(res.body.data.remainingUses).toBe(100);
        expect(res.body.data.isExpired).toBe(false);
        expect(res.body.data.isExhausted).toBe(false);
    });

    it("creates a fixed voucher successfully", async () => {
        const res = await createVoucher({
            code: "FIXED50K",
            discountType: "fixed",
            discountValue: 50000,
        });

        expect(res.status).toBe(201);
        expect(res.body.data.discountType).toBe("fixed");
        expect(res.body.data.discountValue).toBe(50000);
    });

    it("creates voucher scoped to a specific concert", async () => {
        const res = await createVoucher({ code: "CONCERT1", concertId });

        expect(res.status).toBe(201);
        expect(res.body.data.concertId).toBe(concertId);
    });

    it("creates voucher with expiry date in the future", async () => {
        const future = new Date("2099-01-01T00:00:00Z");
        const res = await createVoucher({ code: "EXPIRING", expiresAt: future.toISOString() });

        expect(res.status).toBe(201);
        expect(res.body.data.isExpired).toBe(false);
    });

    it("normalises code to uppercase", async () => {
        const res = await createVoucher({ code: "lowercase10" });
        // Schema rejects non-uppercase → 400
        expect(res.status).toBe(400);
    });

    // ── Conflict ──────────────────────────────────────────────────────────────
    it("rejects duplicate code", async () => {
        await createVoucher();
        const res = await createVoucher();

        expect(res.status).toBe(409);
        expect(res.body.type).toBe("CONFLICT");
    });

    // ── Domain invariants ─────────────────────────────────────────────────────
    it("rejects percentage > 100", async () => {
        const res = await createVoucher({ code: "OVER100", discountValue: 101 });
        expect(res.status).toBe(400);
    });

    it("rejects percentage = 0", async () => {
        const res = await createVoucher({ code: "ZERO", discountValue: 0 });
        expect(res.status).toBe(400);
    });

    it("rejects fixed discount = 0", async () => {
        const res = await createVoucher({ code: "FIXZERO", discountType: "fixed", discountValue: 0 });
        expect(res.status).toBe(400);
    });

    it("rejects maxUses < 1", async () => {
        const res = await createVoucher({ code: "NOMAX", maxUses: 0 });
        expect(res.status).toBe(400);
    });

    it("rejects negative minOrderValue", async () => {
        const res = await createVoucher({ code: "NEGMIN", minOrderValue: -1 });
        expect(res.status).toBe(400);
    });

    it("rejects past expiresAt", async () => {
        const res = await createVoucher({
            code: "EXPIRED",
            expiresAt: new Date("2000-01-01T00:00:00Z").toISOString(),
        });
        expect(res.status).toBe(422);
        expect(res.body.type).toBe("BUSINESS_RULE");
    });

    it("rejects invalid code format (special chars)", async () => {
        const res = await createVoucher({ code: "BAD CODE!" });
        expect(res.status).toBe(400);
    });

    it("rejects code shorter than 3 chars", async () => {
        const res = await createVoucher({ code: "AB" });
        expect(res.status).toBe(400);
    });

    it("rejects concertId pointing to non-existent concert", async () => {
        const res = await createVoucher({
            code: "NOCONCERT",
            concertId: "00000000-0000-0000-0000-000000000000",
        });
        expect(res.status).toBe(404);
    });

    // ── Auth / RBAC ───────────────────────────────────────────────────────────
    it("customer cannot create voucher", async () => {
        const res = await request(app)
            .post("/vouchers")
            .set("Authorization", `Bearer ${customerToken}`)
            .send(makeVoucher({ code: "CUSTV" }));

        expect(res.status).toBe(403);
    });

    it("rejects unauthenticated request", async () => {
        const res = await request(app).post("/vouchers").send(makeVoucher());
        expect(res.status).toBe(401);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// LIST VOUCHERS
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /vouchers (admin)", () => {
    beforeEach(async () => {
        // Seed 3 vouchers: 2 global, 1 scoped
        await Promise.all([
            createVoucher({ code: "GLOBAL1" }),
            createVoucher({ code: "GLOBAL2" }),
            createVoucher({ code: "SCOPED1", concertId }),
        ]);
    });

    it("returns all vouchers with computed fields", async () => {
        const res = await request(app)
            .get("/vouchers")
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.total).toBe(3);
        expect(res.body.data.vouchers[0]).toHaveProperty("remainingUses");
        expect(res.body.data.vouchers[0]).toHaveProperty("isExpired");
        expect(res.body.data.vouchers[0]).toHaveProperty("isExhausted");
    });

    it("filters by concertId", async () => {
        const res = await request(app)
            .get(`/vouchers?concertId=${concertId}`)
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.total).toBe(1);
        expect(res.body.data.vouchers[0].code).toBe("SCOPED1");
    });

    it("respects pagination", async () => {
        const res = await request(app)
            .get("/vouchers?page=1&limit=2")
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.vouchers).toHaveLength(2);
        expect(res.body.data.total).toBe(3);
        expect(res.body.data.page).toBe(1);
        expect(res.body.data.limit).toBe(2);
    });

    it("customer cannot list vouchers", async () => {
        const res = await request(app)
            .get("/vouchers")
            .set("Authorization", `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET VOUCHER BY ID
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /vouchers/:id (admin)", () => {
    it("returns voucher detail", async () => {
        const created = await createVoucher({ code: "DETAIL1" });
        const res = await request(app)
            .get(`/vouchers/${created.body.data.id}`)
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.code).toBe("DETAIL1");
        expect(res.body.data.remainingUses).toBe(100);
    });

    it("returns 404 for non-existent voucher", async () => {
        const res = await request(app)
            .get("/vouchers/00000000-0000-0000-0000-000000000000")
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(404);
    });

    it("returns 400 for invalid UUID", async () => {
        const res = await request(app)
            .get("/vouchers/not-a-uuid")
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// UPDATE VOUCHER
// ═════════════════════════════════════════════════════════════════════════════
describe("PATCH /vouchers/:id (admin)", () => {
    it("updates name only", async () => {
        const created = await createVoucher({ code: "UPDATEME1" });
        const res = await request(app)
            .patch(`/vouchers/${created.body.data.id}`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ name: "Updated Name" });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe("Updated Name");
        // Other fields unchanged
        expect(res.body.data.code).toBe("UPDATEME1");
        expect(res.body.data.discountValue).toBe(10);
    });

    it("increases maxUses successfully", async () => {
        const created = await createVoucher({ code: "UPDATEME2", maxUses: 50 });
        const res = await request(app)
            .patch(`/vouchers/${created.body.data.id}`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ maxUses: 200 });

        expect(res.status).toBe(200);
        expect(res.body.data.maxUses).toBe(200);
        expect(res.body.data.remainingUses).toBe(200);
    });

    it("sets expiresAt to a future date", async () => {
        const created = await createVoucher({ code: "UPDATEME3" });
        const future = new Date("2099-06-01T00:00:00Z").toISOString();

        const res = await request(app)
            .patch(`/vouchers/${created.body.data.id}`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ expiresAt: future });

        expect(res.status).toBe(200);
        expect(res.body.data.expiresAt).toBe(future);
        expect(res.body.data.isExpired).toBe(false);
    });

    it("removes expiresAt by sending null", async () => {
        const created = await createVoucher({
            code: "UPDATEME4",
            expiresAt: "2099-01-01T00:00:00Z",
        });
        const res = await request(app)
            .patch(`/vouchers/${created.body.data.id}`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ expiresAt: null });

        expect(res.status).toBe(200);
        expect(res.body.data.expiresAt).toBeNull();
    });

    it("rejects maxUses below usedCount", async () => {
        // Simulate voucher with usedCount = 5
        const created = await createVoucher({ code: "UPDATEME5", maxUses: 10 });
        await db.update(voucherCampaigns)
            .set({ usedCount: 5 })
            .where(eq(voucherCampaigns.id, created.body.data.id));

        const res = await request(app)
            .patch(`/vouchers/${created.body.data.id}`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ maxUses: 3 }); // 3 < 5

        expect(res.status).toBe(422);
        expect(res.body.type).toBe("BUSINESS_RULE");
        expect(res.body.message).toMatch(/usedCount/);
    });

    it("rejects past expiresAt", async () => {
        const created = await createVoucher({ code: "UPDATEME6" });
        const res = await request(app)
            .patch(`/vouchers/${created.body.data.id}`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ expiresAt: "2000-01-01T00:00:00Z" });

        expect(res.status).toBe(422);
        expect(res.body.type).toBe("BUSINESS_RULE");
        expect(res.body.message).toMatch(/future/);
    });

    it("rejects empty body (no fields provided)", async () => {
        const created = await createVoucher({ code: "UPDATEME7" });
        const res = await request(app)
            .patch(`/vouchers/${created.body.data.id}`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({});

        expect(res.status).toBe(400);
    });

    it("rejects short name", async () => {
        const created = await createVoucher({ code: "UPDATEME8" });
        const res = await request(app)
            .patch(`/vouchers/${created.body.data.id}`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ name: "X" });

        expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent voucher", async () => {
        const res = await request(app)
            .patch("/vouchers/00000000-0000-0000-0000-000000000000")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ name: "Ghost" });

        expect(res.status).toBe(404);
    });

    it("customer cannot update voucher", async () => {
        const created = await createVoucher({ code: "UPDATEME9" });
        const res = await request(app)
            .patch(`/vouchers/${created.body.data.id}`)
            .set("Authorization", `Bearer ${customerToken}`)
            .send({ name: "Hack" });

        expect(res.status).toBe(403);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE VOUCHER
// ═════════════════════════════════════════════════════════════════════════════
describe("DELETE /vouchers/:id (admin)", () => {
    it("deletes voucher with usedCount = 0 successfully", async () => {
        const created = await createVoucher({ code: "DELETEME1" });

        const res = await request(app)
            .delete(`/vouchers/${created.body.data.id}`)
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(204);

        // Verify actually deleted
        const check = await request(app)
            .get(`/vouchers/${created.body.data.id}`)
            .set("Authorization", `Bearer ${adminToken}`);
        expect(check.status).toBe(404);
    });

    it("rejects delete when voucher has been used", async () => {
        const created = await createVoucher({ code: "DELETEME2" });
        // Simulate 1 usage
        await db.update(voucherCampaigns)
            .set({ usedCount: 1 })
            .where(eq(voucherCampaigns.id, created.body.data.id));

        const res = await request(app)
            .delete(`/vouchers/${created.body.data.id}`)
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(422);
        expect(res.body.type).toBe("BUSINESS_RULE");
        expect(res.body.message).toMatch(/been used/);
    });

    it("returns 404 for non-existent voucher", async () => {
        const res = await request(app)
            .delete("/vouchers/00000000-0000-0000-0000-000000000000")
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(404);
    });

    it("customer cannot delete voucher", async () => {
        const created = await createVoucher({ code: "DELETEME3" });
        const res = await request(app)
            .delete(`/vouchers/${created.body.data.id}`)
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(403);
    });

    it("returns 400 for invalid UUID", async () => {
        const res = await request(app)
            .delete("/vouchers/not-a-uuid")
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
    });
});
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /vouchers/preview (customer)", () => {
    beforeEach(async () => {
        await Promise.all([
            createVoucher({ code: "PREVIEW10", discountType: "percentage", discountValue: 10 }),
            createVoucher({ code: "FIXED100K", discountType: "fixed", discountValue: 100000 }),
            createVoucher({ code: "MINORDER", discountType: "fixed", discountValue: 50000, minOrderValue: 1000000 }),
            createVoucher({ code: "SCOPED", discountType: "percentage", discountValue: 15, concertId }),
        ]);
    });

    it("previews percentage discount correctly", async () => {
        const res = await request(app)
            .get(`/vouchers/preview?code=PREVIEW10&orderAmount=2000000&concertId=${concertId}`)
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.discountAmount).toBe(200000);   // 10% of 2_000_000
        expect(res.body.data.finalAmount).toBe(1800000);
        expect(res.body.data.description).toBe("10% off");
    });

    it("previews fixed discount correctly", async () => {
        const res = await request(app)
            .get(`/vouchers/preview?code=FIXED100K&orderAmount=2000000&concertId=${concertId}`)
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.discountAmount).toBe(100000);
        expect(res.body.data.finalAmount).toBe(1900000);
    });

    it("fixed discount cannot exceed order amount (finalAmount >= 0)", async () => {
        const res = await request(app)
            .get(`/vouchers/preview?code=FIXED100K&orderAmount=50000&concertId=${concertId}`)
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        // discount capped at orderAmount
        expect(res.body.data.discountAmount).toBe(50000);
        expect(res.body.data.finalAmount).toBe(0);
    });

    it("rejects when orderAmount below minOrderValue", async () => {
        const res = await request(app)
            .get(`/vouchers/preview?code=MINORDER&orderAmount=500000&concertId=${concertId}`)
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(422);
        expect(res.body.message).toMatch(/Minimum order value/);
    });

    it("rejects voucher scoped to a different concert", async () => {
        const res = await request(app)
            .get(`/vouchers/preview?code=SCOPED&orderAmount=1000000&concertId=${otherConcertId}`)
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(422);
        expect(res.body.message).toMatch(/not valid for this concert/);
    });

    it("accepts scoped voucher with matching concertId", async () => {
        const res = await request(app)
            .get(`/vouchers/preview?code=SCOPED&orderAmount=1000000&concertId=${concertId}`)
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.discountAmount).toBe(150000);  // 15% of 1_000_000
    });

    it("rejects non-existent voucher code", async () => {
        const res = await request(app)
            .get(`/vouchers/preview?code=NOTEXIST&orderAmount=1000000&concertId=${concertId}`)
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(404);
    });

    it("rejects missing required query params", async () => {
        // Missing concertId
        const res = await request(app)
            .get("/vouchers/preview?code=PREVIEW10&orderAmount=1000000")
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(400);
    });

    it("rejects negative orderAmount", async () => {
        const res = await request(app)
            .get(`/vouchers/preview?code=PREVIEW10&orderAmount=-1000&concertId=${concertId}`)
            .set("Authorization", `Bearer ${customerToken}`);

        expect(res.status).toBe(400);
    });

    it("requires authentication", async () => {
        const res = await request(app)
            .get(`/vouchers/preview?code=PREVIEW10&orderAmount=1000000&concertId=${concertId}`);

        expect(res.status).toBe(401);
    });
});