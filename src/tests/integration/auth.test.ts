import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app } from "@/app";
import { db } from "@/infrastructure/db";
import { bookings, concerts, ticketTiers, users, voucherCampaigns } from "@/infrastructure/db/schema";

beforeEach(async () => {
    await db.delete(users);
});

afterAll(async () => {
    await db.delete(bookings);
    await db.delete(ticketTiers);
    await db.delete(voucherCampaigns);
    await db.delete(concerts);
    await db.delete(users);
});

describe("POST /auth/register", () => {
    it("registers a new user and returns accessToken", async () => {
        const res = await request(app)
            .post("/auth/register")
            .send({ email: "test@example.com", password: "secret1234", name: "Test User" });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.user.role).toBe("customer");
    });

    it("rejects duplicate email", async () => {
        const payload = { email: "dup@example.com", password: "secret1234", name: "Dup" };
        await request(app).post("/auth/register").send(payload);
        const res = await request(app).post("/auth/register").send(payload);

        expect(res.status).toBe(409);
        expect(res.body.type).toBe("CONFLICT");
    });

    it("rejects invalid email format", async () => {
        const res = await request(app)
            .post("/auth/register")
            .send({ email: "not-an-email", password: "secret1234", name: "Test" });

        expect(res.status).toBe(400);
    });

    it("rejects short password", async () => {
        const res = await request(app)
            .post("/auth/register")
            .send({ email: "a@b.com", password: "123", name: "Test" });

        expect(res.status).toBe(400);
    });

    it("rejects missing email", async () => {
        const res = await request(app)
            .post("/auth/register")
            .send({ password: "secret1234", name: "Test User" });

        expect(res.status).toBe(400);
    });

    it("rejects missing password", async () => {
        const res = await request(app)
            .post("/auth/register")
            .send({ email: "test@example.com", name: "Test User" });

        expect(res.status).toBe(400);
    });

    it("rejects missing name", async () => {
        const res = await request(app)
            .post("/auth/register")
            .send({ email: "test@example.com", password: "secret1234" });

        expect(res.status).toBe(400);
    });

    it("rejects empty body", async () => {
        const res = await request(app)
            .post("/auth/register")
            .send({});

        expect(res.status).toBe(400);
    });
});

describe("POST /auth/login", () => {
    beforeEach(async () => {
        await request(app)
            .post("/auth/register")
            .send({ email: "login@example.com", password: "secret1234", name: "Login User" });
    });

    it("returns accessToken on valid credentials", async () => {
        const res = await request(app)
            .post("/auth/login")
            .send({ email: "login@example.com", password: "secret1234" });

        expect(res.status).toBe(200);
        expect(res.body.data.accessToken).toBeDefined();
    });

    it("rejects wrong password", async () => {
        const res = await request(app)
            .post("/auth/login")
            .send({ email: "login@example.com", password: "wrongpass" });

        expect(res.status).toBe(401);
    });

    it("rejects non-existent email", async () => {
        const res = await request(app)
            .post("/auth/login")
            .send({ email: "ghost@example.com", password: "secret1234" });

        expect(res.status).toBe(401);
    });

    it("rejects missing email", async () => {
        const res = await request(app)
            .post("/auth/login")
            .send({ password: "secret1234" });

        expect(res.status).toBe(400);
    });

    it("rejects missing password", async () => {
        const res = await request(app)
            .post("/auth/login")
            .send({ email: "login@example.com" });

        expect(res.status).toBe(400);
    });

    it("rejects empty body", async () => {
        const res = await request(app)
            .post("/auth/login")
            .send({});

        expect(res.status).toBe(400);
    });
});

describe("GET /auth/me", () => {
    it("returns current user when token is valid", async () => {
        const regRes = await request(app)
            .post("/auth/register")
            .send({ email: "me@example.com", password: "secret1234", name: "Me User" });

        const token = regRes.body.data.accessToken;

        const res = await request(app)
            .get("/auth/me")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBeDefined();
        expect(res.body.data.role).toBe("customer");
    });

    it("returns 401 when no token", async () => {
        const res = await request(app).get("/auth/me");
        expect(res.status).toBe(401);
    });

    it("returns 401 when token is invalid", async () => {
        const res = await request(app)
            .get("/auth/me")
            .set("Authorization", "Bearer invalid.token.here");
        expect(res.status).toBe(401);
    });

    it("returns 401 when Authorization header is malformed", async () => {
        const res = await request(app)
            .get("/auth/me")
            .set("Authorization", "NotBearer sometoken");
        expect(res.status).toBe(401);
    });

    it("returns 401 when Bearer token is empty", async () => {
        const res = await request(app)
            .get("/auth/me")
            .set("Authorization", "Bearer ");
        expect(res.status).toBe(401);
    });
});