import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "@/app";
import { db } from "@/infrastructure/db";
import { concerts, ticketTiers } from "@/infrastructure/db/schema/concerts";
import { users } from "@/infrastructure/db/schema/users";
import { eq } from "drizzle-orm";
import { bookings, voucherCampaigns } from "@/infrastructure/db/schema";

let adminToken: string;
let customerToken: string;

beforeAll(async () => {
    await db.delete(users);

    const adminReg = await request(app)
        .post("/auth/register")
        .send({ email: "admin@test.com", password: "admin1234", name: "Admin" });
    adminToken = adminReg.body.data.accessToken;

    await db
        .update(users)
        .set({ role: "admin" })
        .where(eq(users.email, "admin@test.com"));

    const adminLogin = await request(app)
        .post("/auth/login")
        .send({ email: "admin@test.com", password: "admin1234" });
    adminToken = adminLogin.body.data.accessToken;

    const custReg = await request(app)
        .post("/auth/register")
        .send({ email: "cust@test.com", password: "cust1234", name: "Customer" });
    customerToken = custReg.body.data.accessToken;
});

beforeEach(async () => {
    await db.delete(ticketTiers);
    await db.delete(concerts);
});

afterAll(async () => {
    await db.delete(bookings);
    await db.delete(ticketTiers);
    await db.delete(voucherCampaigns);
    await db.delete(concerts);
    await db.delete(users);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function createConcert(overrides = {}) {
    return request(app)
        .post("/concerts")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
            name: "Test Concert",
            venue: "Test Venue",
            artistName: "Test Artist",
            eventDate: "2099-12-01T19:00:00Z",
            ...overrides,
        });
}

async function addTiers(concertId: string, tiers = [{ name: "VIP", price: 500000, totalQty: 100 }]) {
    return request(app)
        .post(`/concerts/${concertId}/tiers`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ tiers });
}

async function publishConcert(concertId: string) {
    return request(app)
        .patch(`/concerts/${concertId}/publish`)
        .set("Authorization", `Bearer ${adminToken}`);
}

async function createPublishedConcert(overrides = {}) {
    const c = await createConcert(overrides);
    await addTiers(c.body.data.id);
    await publishConcert(c.body.data.id);
    return c;
}

const UNKNOWN_ID = "00000000-0000-0000-0000-000000000000";

// ── GET /concerts ─────────────────────────────────────────────────────────────
describe("GET /concerts", () => {
    it("returns empty list when no concerts", async () => {
        const res = await request(app).get("/concerts");
        expect(res.status).toBe(200);
        expect(res.body.data.concerts).toHaveLength(0);
        expect(res.body.data.total).toBe(0);
    });

    it("returns all concerts without filter", async () => {
        await createConcert({ name: "Concert A" });
        await createConcert({ name: "Concert B" });
        const res = await request(app).get("/concerts");
        expect(res.status).toBe(200);
        expect(res.body.data.concerts).toHaveLength(2);
        expect(res.body.data.total).toBe(2);
    });

    it("returns only on_sale concerts when filtered", async () => {
        await createConcert({ name: "Draft Concert" });
        const c2 = await createConcert({ name: "OnSale Concert" });
        await addTiers(c2.body.data.id);
        await publishConcert(c2.body.data.id);

        const res = await request(app).get("/concerts?status=on_sale");
        expect(res.status).toBe(200);
        expect(res.body.data.concerts).toHaveLength(1);
        expect(res.body.data.concerts[0].name).toBe("OnSale Concert");
    });

    it("returns only draft concerts when filtered", async () => {
        await createConcert({ name: "Draft Concert" });
        const c2 = await createConcert({ name: "OnSale Concert" });
        await addTiers(c2.body.data.id);
        await publishConcert(c2.body.data.id);

        const res = await request(app).get("/concerts?status=draft");
        expect(res.status).toBe(200);
        expect(res.body.data.concerts).toHaveLength(1);
        expect(res.body.data.concerts[0].name).toBe("Draft Concert");
    });

    it("returns only cancelled concerts when filtered", async () => {
        const c = await createConcert({ name: "Cancelled Concert" });
        await request(app)
            .patch(`/concerts/${c.body.data.id}/cancel`)
            .set("Authorization", `Bearer ${adminToken}`);

        const res = await request(app).get("/concerts?status=cancelled");
        expect(res.status).toBe(200);
        expect(res.body.data.concerts).toHaveLength(1);
        expect(res.body.data.concerts[0].name).toBe("Cancelled Concert");
    });

    it("respects pagination limit", async () => {
        await createConcert({ name: "Concert A" });
        await createConcert({ name: "Concert B" });
        await createConcert({ name: "Concert C" });

        const res = await request(app).get("/concerts?page=1&limit=2");
        expect(res.status).toBe(200);
        expect(res.body.data.concerts).toHaveLength(2);
        expect(res.body.data.total).toBe(3);
    });

    it("returns second page correctly", async () => {
        await createConcert({ name: "Concert A" });
        await createConcert({ name: "Concert B" });
        await createConcert({ name: "Concert C" });

        const res = await request(app).get("/concerts?page=2&limit=2");
        expect(res.status).toBe(200);
        expect(res.body.data.concerts).toHaveLength(1);
    });
});

// ── GET /concerts/:id ─────────────────────────────────────────────────────────
describe("GET /concerts/:id", () => {
    it("returns concert with tiers", async () => {
        const created = await createConcert();
        await addTiers(created.body.data.id);

        const res = await request(app).get(`/concerts/${created.body.data.id}`);
        expect(res.status).toBe(200);
        expect(res.body.data.concert.name).toBe("Test Concert");
        expect(res.body.data.tiers).toHaveLength(1);
        expect(res.body.data.tiers[0].availableQty).toBe(100);
    });

    it("returns concert with empty tiers when none added", async () => {
        const created = await createConcert();
        const res = await request(app).get(`/concerts/${created.body.data.id}`);
        expect(res.status).toBe(200);
        expect(res.body.data.tiers).toHaveLength(0);
    });

    it("returns 404 for unknown concert", async () => {
        const res = await request(app).get(`/concerts/${UNKNOWN_ID}`);
        expect(res.status).toBe(404);
    });

    it("returns 400 for invalid UUID format", async () => {
        const res = await request(app).get("/concerts/not-a-uuid");
        expect(res.status).toBe(400);
    });
});

// ── POST /concerts ────────────────────────────────────────────────────────────
describe("POST /concerts (admin)", () => {
    it("creates concert in draft status", async () => {
        const res = await createConcert();
        expect(res.status).toBe(201);
        expect(res.body.data.status).toBe("draft");
        expect(res.body.data.id).toBeDefined();
    });

    it("returns correct concert data", async () => {
        const res = await createConcert({ name: "My Concert", venue: "Hanoi", artistName: "Artist X" });
        expect(res.status).toBe(201);
        expect(res.body.data.name).toBe("My Concert");
        expect(res.body.data.venue).toBe("Hanoi");
        expect(res.body.data.artistName).toBe("Artist X");
    });

    it("rejects past eventDate", async () => {
        const res = await createConcert({ eventDate: "2000-01-01T00:00:00Z" });
        expect(res.status).toBe(400);
    });

    it("rejects missing name", async () => {
        const res = await request(app)
            .post("/concerts")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ venue: "V", artistName: "A", eventDate: "2099-01-01T00:00:00Z" });
        expect(res.status).toBe(400);
    });

    it("rejects missing venue", async () => {
        const res = await request(app)
            .post("/concerts")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ name: "N", artistName: "A", eventDate: "2099-01-01T00:00:00Z" });
        expect(res.status).toBe(400);
    });

    it("rejects missing artistName", async () => {
        const res = await request(app)
            .post("/concerts")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ name: "N", venue: "V", eventDate: "2099-01-01T00:00:00Z" });
        expect(res.status).toBe(400);
    });

    it("rejects missing eventDate", async () => {
        const res = await request(app)
            .post("/concerts")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ name: "N", venue: "V", artistName: "A" });
        expect(res.status).toBe(400);
    });

    it("rejects unauthenticated request", async () => {
        const res = await request(app)
            .post("/concerts")
            .send({ name: "N", venue: "V", artistName: "A", eventDate: "2099-01-01T00:00:00Z" });
        expect(res.status).toBe(401);
    });

    it("rejects customer creating concert", async () => {
        const res = await request(app)
            .post("/concerts")
            .set("Authorization", `Bearer ${customerToken}`)
            .send({ name: "Hack", venue: "V", artistName: "A", eventDate: "2099-01-01T00:00:00Z" });
        expect(res.status).toBe(403);
    });
});

// ── POST /concerts/:id/tiers ──────────────────────────────────────────────────
describe("POST /concerts/:id/tiers (admin)", () => {
    it("adds tiers successfully", async () => {
        const c = await createConcert();
        const res = await addTiers(c.body.data.id);
        expect(res.status).toBe(201);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].name).toBe("VIP");
        expect(res.body.data[0].totalQty).toBe(100);
    });

    it("adds multiple tiers", async () => {
        const c = await createConcert();
        const res = await addTiers(c.body.data.id, [
            { name: "VIP", price: 500000, totalQty: 50 },
            { name: "Standard", price: 200000, totalQty: 200 },
        ]);
        expect(res.status).toBe(201);
        expect(res.body.data).toHaveLength(2);
    });

    it("rejects negative price", async () => {
        const c = await createConcert();
        const res = await addTiers(c.body.data.id, [{ name: "VIP", price: -1, totalQty: 100 }]);
        expect(res.status).toBe(400);
    });

    it("rejects zero totalQty", async () => {
        const c = await createConcert();
        const res = await addTiers(c.body.data.id, [{ name: "VIP", price: 100000, totalQty: 0 }]);
        expect(res.status).toBe(400);
    });

    it("rejects empty tiers array", async () => {
        const c = await createConcert();
        const res = await request(app)
            .post(`/concerts/${c.body.data.id}/tiers`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ tiers: [] });
        expect(res.status).toBe(400);
    });

    it("returns 404 for unknown concert", async () => {
        const res = await addTiers(UNKNOWN_ID);
        expect(res.status).toBe(404);
    });

    it("rejects unauthenticated request", async () => {
        const c = await createConcert();
        const res = await request(app)
            .post(`/concerts/${c.body.data.id}/tiers`)
            .send({ tiers: [{ name: "VIP", price: 500000, totalQty: 100 }] });
        expect(res.status).toBe(401);
    });

    it("rejects customer adding tiers", async () => {
        const c = await createConcert();
        const res = await request(app)
            .post(`/concerts/${c.body.data.id}/tiers`)
            .set("Authorization", `Bearer ${customerToken}`)
            .send({ tiers: [{ name: "VIP", price: 500000, totalQty: 100 }] });
        expect(res.status).toBe(403);
    });
});

// ── PATCH /concerts/:id/publish ───────────────────────────────────────────────
describe("PATCH /concerts/:id/publish (admin)", () => {
    it("publishes concert when it has tiers", async () => {
        const c = await createConcert();
        await addTiers(c.body.data.id);
        const res = await publishConcert(c.body.data.id);
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe("on_sale");
    });

    it("rejects publish when concert has no tiers", async () => {
        const c = await createConcert();
        const res = await publishConcert(c.body.data.id);
        expect(res.status).toBe(422);
    });

    it("rejects double publish", async () => {
        const c = await createConcert();
        await addTiers(c.body.data.id);
        await publishConcert(c.body.data.id);
        const res = await publishConcert(c.body.data.id);
        expect(res.status).toBe(422);
    });

    it("rejects publish for unknown concert", async () => {
        const res = await request(app)
            .patch(`/concerts/${UNKNOWN_ID}/publish`)
            .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(404);
    });

    it("rejects unauthenticated request", async () => {
        const c = await createConcert();
        await addTiers(c.body.data.id);
        const res = await request(app).patch(`/concerts/${c.body.data.id}/publish`);
        expect(res.status).toBe(401);
    });

    it("rejects customer publishing concert", async () => {
        const c = await createConcert();
        await addTiers(c.body.data.id);
        const res = await request(app)
            .patch(`/concerts/${c.body.data.id}/publish`)
            .set("Authorization", `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
    });
});

// ── PATCH /concerts/:id/cancel ────────────────────────────────────────────────
describe("PATCH /concerts/:id/cancel (admin)", () => {
    it("cancels a draft concert", async () => {
        const c = await createConcert();
        const res = await request(app)
            .patch(`/concerts/${c.body.data.id}/cancel`)
            .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe("cancelled");
    });

    it("cancels an on_sale concert", async () => {
        const c = await createConcert();
        await addTiers(c.body.data.id);
        await publishConcert(c.body.data.id);
        const res = await request(app)
            .patch(`/concerts/${c.body.data.id}/cancel`)
            .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe("cancelled");
    });

    it("rejects double cancel", async () => {
        const c = await createConcert();
        await request(app)
            .patch(`/concerts/${c.body.data.id}/cancel`)
            .set("Authorization", `Bearer ${adminToken}`);
        const res = await request(app)
            .patch(`/concerts/${c.body.data.id}/cancel`)
            .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(422);
    });

    it("returns 404 for unknown concert", async () => {
        const res = await request(app)
            .patch(`/concerts/${UNKNOWN_ID}/cancel`)
            .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(404);
    });

    it("rejects unauthenticated request", async () => {
        const c = await createConcert();
        const res = await request(app).patch(`/concerts/${c.body.data.id}/cancel`);
        expect(res.status).toBe(401);
    });

    it("rejects customer cancelling concert", async () => {
        const c = await createConcert();
        const res = await request(app)
            .patch(`/concerts/${c.body.data.id}/cancel`)
            .set("Authorization", `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
    });
});

// ── GET /concerts/:id/availability ───────────────────────────────────────────
describe("GET /concerts/:id/availability", () => {
    it("returns tier availability info", async () => {
        const c = await createConcert();
        await addTiers(c.body.data.id);
        const res = await request(app).get(`/concerts/${c.body.data.id}/availability`);
        expect(res.status).toBe(200);
        expect(res.body.data[0].availableQty).toBe(100);
        expect(res.body.data[0].reservedQty).toBe(0);
    });

    it("returns availability for multiple tiers", async () => {
        const c = await createConcert();
        await addTiers(c.body.data.id, [
            { name: "VIP", price: 500000, totalQty: 50 },
            { name: "Standard", price: 200000, totalQty: 200 },
        ]);
        const res = await request(app).get(`/concerts/${c.body.data.id}/availability`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
    });

    it("returns 404 for unknown concert", async () => {
        const res = await request(app).get(`/concerts/${UNKNOWN_ID}/availability`);
        expect(res.status).toBe(404);
    });

    it("returns 400 for invalid UUID", async () => {
        const res = await request(app).get("/concerts/not-a-uuid/availability");
        expect(res.status).toBe(400);
    });
});