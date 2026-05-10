import { describe, it, expect } from "vitest";
import { User } from "@/modules/auth/domain/user.entity";

// ── Factory ───────────────────────────────────────────────────────────────────
function makeUser(overrides: Partial<Parameters<typeof User.create>[0]> = {}) {
    return User.create({
        id: "u1000000-0000-0000-0000-000000000001",
        email: "user@example.com",
        passwordHash: "$2b$10$hashedpassword",
        name: "Nguyen Van A",
        ...overrides,
    });
}

function unwrap(r: ReturnType<typeof User.create>): User {
    if (r.isErr()) throw new Error(`Unexpected Err: ${r.error.message}`);
    return r.value;
}

// ═════════════════════════════════════════════════════════════════════════════
// User.create
// ═════════════════════════════════════════════════════════════════════════════
describe("User.create", () => {
    describe("email validation", () => {
        it("accepts valid email", () => {
            expect(makeUser({ email: "valid@example.com" }).isOk()).toBe(true);
        });

        it("normalises email to lowercase", () => {
            const u = unwrap(makeUser({ email: "USER@EXAMPLE.COM" }));
            expect(u.email).toBe("user@example.com");
        });

        it("trims whitespace from email", () => {
            const u = unwrap(makeUser({ email: "  user@example.com  " }));
            expect(u.email).toBe("user@example.com");
        });

        it("rejects email without @", () => {
            const r = makeUser({ email: "notanemail" });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().message).toMatch(/Invalid email/);
        });

        it("rejects empty string email", () => {
            expect(makeUser({ email: "" }).isErr()).toBe(true);
        });
    });

    describe("name validation", () => {
        it("accepts name with 2+ chars", () => {
            expect(makeUser({ name: "AB" }).isOk()).toBe(true);
        });

        it("rejects name shorter than 2 chars", () => {
            const r = makeUser({ name: "A" });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().message).toMatch(/at least 2/);
        });

        it("rejects blank name (whitespace only)", () => {
            expect(makeUser({ name: "  " }).isErr()).toBe(true);
        });

        it("trims whitespace from name", () => {
            const u = unwrap(makeUser({ name: "  John Doe  " }));
            expect(u.name).toBe("John Doe");
        });
    });

    describe("passwordHash validation", () => {
        it("accepts non-empty hash", () => {
            expect(makeUser({ passwordHash: "x" }).isOk()).toBe(true);
        });

        it("rejects empty passwordHash", () => {
            const r = makeUser({ passwordHash: "" });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().message).toMatch(/cannot be empty/);
        });
    });

    describe("role", () => {
        it("defaults to customer when role not provided", () => {
            expect(unwrap(makeUser()).role).toBe("customer");
        });

        it("accepts explicit customer role", () => {
            expect(unwrap(makeUser({ role: "customer" })).role).toBe("customer");
        });

        it("accepts admin role", () => {
            expect(unwrap(makeUser({ role: "admin" })).role).toBe("admin");
        });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// User.isAdmin()
// ═════════════════════════════════════════════════════════════════════════════
describe("User.isAdmin()", () => {
    it("returns false for customer", () => {
        const u = User.fromRow({
            id: "u1", email: "a@b.com", passwordHash: "x",
            name: "A", role: "customer", createdAt: new Date(), updatedAt: new Date(),
        });
        expect(u.isAdmin()).toBe(false);
    });

    it("returns true for admin", () => {
        const u = User.fromRow({
            id: "u1", email: "a@b.com", passwordHash: "x",
            name: "A", role: "admin", createdAt: new Date(), updatedAt: new Date(),
        });
        expect(u.isAdmin()).toBe(true);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// Immutability
// ═════════════════════════════════════════════════════════════════════════════
describe("User immutability", () => {
    it("toPersistence() returns a copy, not internal reference", () => {
        const u = unwrap(makeUser());
        const p1 = u.toPersistence();
        const p2 = u.toPersistence();
        expect(p1).not.toBe(p2);       // different object references
        expect(p1).toEqual(p2);        // but same values
    });

    it("mutating toPersistence() result does not affect entity", () => {
        const u = unwrap(makeUser({ name: "Original" }));
        const p = u.toPersistence();
        (p as any).name = "Mutated";
        expect(u.name).toBe("Original");
    });
});