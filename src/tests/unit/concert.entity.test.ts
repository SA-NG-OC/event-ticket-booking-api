import { describe, it, expect } from "vitest";
import { Concert, TicketTier } from "@/modules/concert/domain/concert.entity";

const FUTURE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1_000);
const PAST = new Date(Date.now() - 1_000);

// ── Factories ─────────────────────────────────────────────────────────────────
function makeConcert(overrides: Partial<Parameters<typeof Concert.create>[0]> = {}) {
    return Concert.create({
        id: "c1000000-0000-0000-0000-000000000001",
        name: "Test Concert",
        description: null,
        venue: "Test Venue",
        artistName: "Test Artist",
        eventDate: FUTURE,
        ...overrides,
    });
}

function makeConcertFromRow(overrides: Partial<Parameters<typeof Concert.fromRow>[0]> = {}) {
    return Concert.fromRow({
        id: "c1000000-0000-0000-0000-000000000001",
        name: "Test Concert",
        description: null,
        venue: "Test Venue",
        artistName: "Test Artist",
        eventDate: FUTURE,
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    });
}

function makeTier(overrides: Partial<Parameters<typeof TicketTier.create>[0]> = {}) {
    return TicketTier.create({
        id: "t1000000-0000-0000-0000-000000000001",
        concertId: "c1000000-0000-0000-0000-000000000001",
        name: "Standard",
        price: 1_000_000,
        totalQty: 100,
        ...overrides,
    });
}

function makeTierFromRow(overrides: Partial<Parameters<typeof TicketTier.fromRow>[0]> = {}) {
    return TicketTier.fromRow({
        id: "t1000000-0000-0000-0000-000000000001",
        concertId: "c1000000-0000-0000-0000-000000000001",
        name: "Standard",
        price: 1_000_000,
        totalQty: 100,
        reservedQty: 0,
        soldQty: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    });
}

function unwrapConcert(r: ReturnType<typeof Concert.create>): Concert {
    if (r.isErr()) throw new Error(`Unexpected Err: ${r.error.message}`);
    return r.value;
}

function unwrapTier(r: ReturnType<typeof TicketTier.create>): TicketTier {
    if (r.isErr()) throw new Error(`Unexpected Err: ${r.error.message}`);
    return r.value;
}

// ═════════════════════════════════════════════════════════════════════════════
// Concert.create
// ═════════════════════════════════════════════════════════════════════════════
describe("Concert.create", () => {
    describe("name validation", () => {
        it("accepts name with 3+ chars", () => {
            expect(makeConcert({ name: "ABC" }).isOk()).toBe(true);
        });

        it("rejects name shorter than 3 chars", () => {
            const r = makeConcert({ name: "AB" });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().message).toMatch(/at least 3/);
        });

        it("rejects blank name (whitespace only)", () => {
            expect(makeConcert({ name: "   " }).isErr()).toBe(true);
        });

        it("trims name before storing", () => {
            const c = unwrapConcert(makeConcert({ name: "  My Concert  " }));
            expect(c.name).toBe("My Concert");
        });
    });

    describe("venue validation", () => {
        it("accepts venue with 2+ chars", () => {
            expect(makeConcert({ venue: "AB" }).isOk()).toBe(true);
        });

        it("rejects venue shorter than 2 chars", () => {
            const r = makeConcert({ venue: "A" });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().message).toMatch(/Venue is required/);
        });

        it("trims venue before storing", () => {
            const c = unwrapConcert(makeConcert({ venue: "  My Venue  " }));
            expect(c.venue).toBe("My Venue");
        });
    });

    describe("eventDate validation", () => {
        it("accepts future date", () => {
            expect(makeConcert({ eventDate: FUTURE }).isOk()).toBe(true);
        });

        it("rejects past date", () => {
            const r = makeConcert({ eventDate: PAST });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().message).toMatch(/future/);
        });

        it("rejects current time (now)", () => {
            expect(makeConcert({ eventDate: new Date() }).isErr()).toBe(true);
        });
    });

    describe("initial state", () => {
        it("starts with status = draft", () => {
            expect(unwrapConcert(makeConcert()).status).toBe("draft");
        });

        it("isAcceptingBookings() = false on creation", () => {
            expect(unwrapConcert(makeConcert()).isAcceptingBookings()).toBe(false);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// Concert state machine
// ═════════════════════════════════════════════════════════════════════════════
describe("Concert state machine", () => {
    describe("publish()", () => {
        it("draft → on_sale", () => {
            const c = makeConcertFromRow({ status: "draft" });
            const r = c.publish();
            expect(r.isOk()).toBe(true);
            expect(r._unsafeUnwrap().status).toBe("on_sale");
        });

        it("on_sale → publish is rejected", () => {
            const c = makeConcertFromRow({ status: "on_sale" });
            const r = c.publish();
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().type).toBe("BUSINESS_RULE");
            expect(r._unsafeUnwrapErr().message).toMatch(/on_sale/);
        });

        it("cancelled → publish is rejected", () => {
            const c = makeConcertFromRow({ status: "cancelled" });
            expect(c.publish().isErr()).toBe(true);
        });

        it("completed → publish is rejected", () => {
            const c = makeConcertFromRow({ status: "completed" });
            expect(c.publish().isErr()).toBe(true);
        });

        it("sold_out → publish is rejected", () => {
            const c = makeConcertFromRow({ status: "sold_out" });
            expect(c.publish().isErr()).toBe(true);
        });
    });

    describe("cancel()", () => {
        it("draft → cancelled", () => {
            const c = makeConcertFromRow({ status: "draft" });
            const r = c.cancel();
            expect(r.isOk()).toBe(true);
            expect(r._unsafeUnwrap().status).toBe("cancelled");
        });

        it("on_sale → cancelled", () => {
            const c = makeConcertFromRow({ status: "on_sale" });
            expect(c.cancel().isOk()).toBe(true);
        });

        it("sold_out → cancelled", () => {
            const c = makeConcertFromRow({ status: "sold_out" });
            expect(c.cancel().isOk()).toBe(true);
        });

        it("cancelled → cancel is rejected", () => {
            const c = makeConcertFromRow({ status: "cancelled" });
            const r = c.cancel();
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().type).toBe("BUSINESS_RULE");
            expect(r._unsafeUnwrapErr().message).toMatch(/cancelled/);
        });

        it("completed → cancel is rejected", () => {
            const c = makeConcertFromRow({ status: "completed" });
            expect(c.cancel().isErr()).toBe(true);
        });
    });

    describe("isAcceptingBookings()", () => {
        it("returns true only when on_sale", () => {
            expect(makeConcertFromRow({ status: "on_sale" }).isAcceptingBookings()).toBe(true);
        });

        it("returns false for draft", () => {
            expect(makeConcertFromRow({ status: "draft" }).isAcceptingBookings()).toBe(false);
        });

        it("returns false for sold_out", () => {
            expect(makeConcertFromRow({ status: "sold_out" }).isAcceptingBookings()).toBe(false);
        });

        it("returns false for cancelled", () => {
            expect(makeConcertFromRow({ status: "cancelled" }).isAcceptingBookings()).toBe(false);
        });

        it("returns false for completed", () => {
            expect(makeConcertFromRow({ status: "completed" }).isAcceptingBookings()).toBe(false);
        });
    });

    describe("immutability", () => {
        it("publish() returns new instance, original unchanged", () => {
            const original = makeConcertFromRow({ status: "draft" });
            const published = original.publish()._unsafeUnwrap();
            expect(original.status).toBe("draft");
            expect(published.status).toBe("on_sale");
            expect(original).not.toBe(published);
        });

        it("cancel() returns new instance, original unchanged", () => {
            const original = makeConcertFromRow({ status: "on_sale" });
            const cancelled = original.cancel()._unsafeUnwrap();
            expect(original.status).toBe("on_sale");
            expect(cancelled.status).toBe("cancelled");
        });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// TicketTier.create
// ═════════════════════════════════════════════════════════════════════════════
describe("TicketTier.create", () => {
    describe("price validation", () => {
        it("accepts positive price", () => {
            expect(makeTier({ price: 1 }).isOk()).toBe(true);
        });

        it("rejects price = 0", () => {
            const r = makeTier({ price: 0 });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().message).toMatch(/greater than 0/);
        });

        it("rejects negative price", () => {
            expect(makeTier({ price: -1_000 }).isErr()).toBe(true);
        });
    });

    describe("totalQty validation", () => {
        it("accepts totalQty = 1 (min)", () => {
            expect(makeTier({ totalQty: 1 }).isOk()).toBe(true);
        });

        it("rejects totalQty = 0", () => {
            const r = makeTier({ totalQty: 0 });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().message).toMatch(/greater than 0/);
        });

        it("rejects negative totalQty", () => {
            expect(makeTier({ totalQty: -1 }).isErr()).toBe(true);
        });
    });

    describe("initial state", () => {
        it("reservedQty starts at 0", () => {
            expect(unwrapTier(makeTier()).reservedQty).toBe(0);
        });

        it("soldQty starts at 0", () => {
            expect(unwrapTier(makeTier()).soldQty).toBe(0);
        });

        it("availableQty equals totalQty on creation", () => {
            const t = unwrapTier(makeTier({ totalQty: 100 }));
            expect(t.availableQty).toBe(100);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// TicketTier.availableQty + hasAvailableQty
// ═════════════════════════════════════════════════════════════════════════════
describe("TicketTier availability", () => {
    describe("availableQty computation", () => {
        it("availableQty = totalQty - reservedQty - soldQty", () => {
            const t = makeTierFromRow({ totalQty: 100, reservedQty: 30, soldQty: 20 });
            expect(t.availableQty).toBe(50);
        });

        it("availableQty = 0 when fully reserved", () => {
            const t = makeTierFromRow({ totalQty: 10, reservedQty: 10, soldQty: 0 });
            expect(t.availableQty).toBe(0);
        });

        it("availableQty = 0 when fully sold", () => {
            const t = makeTierFromRow({ totalQty: 10, reservedQty: 0, soldQty: 10 });
            expect(t.availableQty).toBe(0);
        });

        it("availableQty accounts for both reserved and sold", () => {
            const t = makeTierFromRow({ totalQty: 100, reservedQty: 40, soldQty: 40 });
            expect(t.availableQty).toBe(20);
        });
    });

    describe("hasAvailableQty()", () => {
        it("returns true when enough available", () => {
            const t = makeTierFromRow({ totalQty: 100, reservedQty: 90, soldQty: 0 });
            expect(t.hasAvailableQty(10)).toBe(true);
        });

        it("returns true at exact boundary (requested = available)", () => {
            const t = makeTierFromRow({ totalQty: 100, reservedQty: 95, soldQty: 0 });
            expect(t.hasAvailableQty(5)).toBe(true);
        });

        it("returns false when not enough available", () => {
            const t = makeTierFromRow({ totalQty: 100, reservedQty: 96, soldQty: 0 });
            expect(t.hasAvailableQty(5)).toBe(false);
        });

        it("returns false when sold out", () => {
            const t = makeTierFromRow({ totalQty: 10, reservedQty: 5, soldQty: 5 });
            expect(t.hasAvailableQty(1)).toBe(false);
        });

        it("returns false when requesting 0 tickets from empty tier", () => {
            const t = makeTierFromRow({ totalQty: 10, reservedQty: 10, soldQty: 0 });
            expect(t.hasAvailableQty(1)).toBe(false);
        });
    });
});