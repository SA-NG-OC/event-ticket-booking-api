import { describe, it, expect } from "vitest";
import { Booking } from "@/modules/booking/domain/booking.entity";

// ── Factory helper ────────────────────────────────────────────────────────────
function makeBooking(overrides: Partial<Parameters<typeof Booking.create>[0]> = {}) {
    return Booking.create({
        id: "b1000000-0000-0000-0000-000000000001",
        userId: "u1000000-0000-0000-0000-000000000001",
        ticketTierId: "t1000000-0000-0000-0000-000000000001",
        concertId: "c1000000-0000-0000-0000-000000000001",
        quantity: 2,
        unitPrice: 1_000_000,
        discountAmount: 0,
        voucherCode: null,
        idempotencyKey: "ik000000-0000-0000-0000-000000000001",
        ...overrides,
    });
}

// Unwrap Ok — throw nếu Err (dùng trong setup, không phải trong assert)
function unwrap<T>(result: ReturnType<typeof Booking.create>): Booking {
    if (result.isErr()) throw new Error(`Unexpected Err: ${result.error.message}`);
    return result.value;
}

// ═════════════════════════════════════════════════════════════════════════════
// Booking.create
// ═════════════════════════════════════════════════════════════════════════════
describe("Booking.create", () => {
    describe("amount calculation", () => {
        it("computes totalAmount = unitPrice × quantity", () => {
            const b = unwrap(makeBooking({ unitPrice: 1_500_000, quantity: 3 }));
            expect(b.totalAmount).toBe(4_500_000);
        });

        it("computes finalAmount = totalAmount - discountAmount", () => {
            const b = unwrap(makeBooking({ unitPrice: 1_000_000, quantity: 2, discountAmount: 300_000 }));
            expect(b.totalAmount).toBe(2_000_000);
            expect(b.finalAmount).toBe(1_700_000);
        });

        it("clamps finalAmount to 0 when discount exceeds total", () => {
            const b = unwrap(makeBooking({ unitPrice: 100_000, quantity: 1, discountAmount: 500_000 }));
            expect(b.finalAmount).toBe(0);
        });

        it("finalAmount equals totalAmount when no discount", () => {
            const b = unwrap(makeBooking({ unitPrice: 2_000_000, quantity: 1, discountAmount: 0 }));
            expect(b.finalAmount).toBe(b.totalAmount);
        });
    });

    describe("initial state", () => {
        it("starts with status = pending", () => {
            const b = unwrap(makeBooking());
            expect(b.status).toBe("pending");
        });

        it("starts with isFlagged = false and flagReason = null", () => {
            const b = unwrap(makeBooking());
            expect(b.isFlagged).toBe(false);
            expect(b.flagReason).toBeNull();
        });
    });

    describe("quantity validation", () => {
        it("accepts quantity = 1 (min)", () => {
            expect(makeBooking({ quantity: 1 }).isOk()).toBe(true);
        });

        it("accepts quantity = 10 (max)", () => {
            expect(makeBooking({ quantity: 10 }).isOk()).toBe(true);
        });

        it("rejects quantity = 0", () => {
            const r = makeBooking({ quantity: 0 });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().type).toBe("VALIDATION");
            expect(r._unsafeUnwrapErr().message).toMatch(/between 1 and 10/);
        });

        it("rejects quantity = 11", () => {
            const r = makeBooking({ quantity: 11 });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().message).toMatch(/between 1 and 10/);
        });

        it("rejects negative quantity", () => {
            expect(makeBooking({ quantity: -1 }).isErr()).toBe(true);
        });
    });

    describe("unitPrice validation", () => {
        it("rejects unitPrice = 0", () => {
            const r = makeBooking({ unitPrice: 0 });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().message).toMatch(/greater than 0/);
        });

        it("rejects negative unitPrice", () => {
            expect(makeBooking({ unitPrice: -1_000 }).isErr()).toBe(true);
        });
    });

    describe("discountAmount validation", () => {
        it("accepts discountAmount = 0", () => {
            expect(makeBooking({ discountAmount: 0 }).isOk()).toBe(true);
        });

        it("rejects negative discountAmount", () => {
            const r = makeBooking({ discountAmount: -1 });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().message).toMatch(/negative/);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// State machine — transitions
// ═════════════════════════════════════════════════════════════════════════════
describe("Booking state machine", () => {
    // ── confirm() ─────────────────────────────────────────────────────────────
    describe("confirm()", () => {
        it("pending → confirmed", () => {
            const b = unwrap(makeBooking());
            const r = b.confirm();
            expect(r.isOk()).toBe(true);
            expect(r._unsafeUnwrap().status).toBe("confirmed");
        });

        it("confirmed → confirmed is rejected", () => {
            const confirmed = unwrap(makeBooking()).confirm()._unsafeUnwrap();
            const r = confirmed.confirm();
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().type).toBe("BUSINESS_RULE");
            expect(r._unsafeUnwrapErr().message).toMatch(/confirmed/);
        });

        it("cancelled → confirmed is rejected", () => {
            const cancelled = unwrap(makeBooking()).cancel()._unsafeUnwrap();
            expect(cancelled.confirm().isErr()).toBe(true);
        });

        it("failed → confirmed is rejected", () => {
            const failed = unwrap(makeBooking()).fail()._unsafeUnwrap();
            expect(failed.confirm().isErr()).toBe(true);
        });
    });

    // ── fail() ────────────────────────────────────────────────────────────────
    describe("fail()", () => {
        it("pending → failed", () => {
            const b = unwrap(makeBooking());
            const r = b.fail();
            expect(r.isOk()).toBe(true);
            expect(r._unsafeUnwrap().status).toBe("failed");
        });

        it("confirmed → failed is rejected", () => {
            const confirmed = unwrap(makeBooking()).confirm()._unsafeUnwrap();
            expect(confirmed.fail().isErr()).toBe(true);
        });

        it("cancelled → failed is rejected", () => {
            const cancelled = unwrap(makeBooking()).cancel()._unsafeUnwrap();
            expect(cancelled.fail().isErr()).toBe(true);
        });
    });

    // ── cancel() ──────────────────────────────────────────────────────────────
    describe("cancel()", () => {
        it("pending → cancelled", () => {
            const r = unwrap(makeBooking()).cancel();
            expect(r.isOk()).toBe(true);
            expect(r._unsafeUnwrap().status).toBe("cancelled");
        });

        it("confirmed → cancelled", () => {
            const confirmed = unwrap(makeBooking()).confirm()._unsafeUnwrap();
            const r = confirmed.cancel();
            expect(r.isOk()).toBe(true);
            expect(r._unsafeUnwrap().status).toBe("cancelled");
        });

        it("cancelled → cancelled is rejected", () => {
            const cancelled = unwrap(makeBooking()).cancel()._unsafeUnwrap();
            const r = cancelled.cancel();
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().type).toBe("BUSINESS_RULE");
            expect(r._unsafeUnwrapErr().message).toMatch(/cancelled/);
        });

        it("failed → cancelled is rejected", () => {
            const failed = unwrap(makeBooking()).fail()._unsafeUnwrap();
            expect(failed.cancel().isErr()).toBe(true);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// needsInventoryRelease
// ═════════════════════════════════════════════════════════════════════════════
describe("Booking.needsInventoryRelease()", () => {
    it("returns false when pending", () => {
        expect(unwrap(makeBooking()).needsInventoryRelease()).toBe(false);
    });

    it("returns true when confirmed", () => {
        const confirmed = unwrap(makeBooking()).confirm()._unsafeUnwrap();
        expect(confirmed.needsInventoryRelease()).toBe(true);
    });

    it("returns false when cancelled from pending", () => {
        const cancelled = unwrap(makeBooking()).cancel()._unsafeUnwrap();
        expect(cancelled.needsInventoryRelease()).toBe(false);
    });

    it("returns false when failed", () => {
        const failed = unwrap(makeBooking()).fail()._unsafeUnwrap();
        expect(failed.needsInventoryRelease()).toBe(false);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// flag / unflag
// ═════════════════════════════════════════════════════════════════════════════
describe("Booking flag / unflag", () => {
    it("flag() sets isFlagged = true and stores reason", () => {
        const b = unwrap(makeBooking());
        const r = b.flag("Suspected bot");
        expect(r.isOk()).toBe(true);
        const flagged = r._unsafeUnwrap();
        expect(flagged.isFlagged).toBe(true);
        expect(flagged.flagReason).toBe("Suspected bot");
    });

    it("flag() rejects empty reason", () => {
        const r = unwrap(makeBooking()).flag("   ");
        expect(r.isErr()).toBe(true);
        expect(r._unsafeUnwrapErr().type).toBe("VALIDATION");
    });

    it("flag() rejects empty string reason", () => {
        const r = unwrap(makeBooking()).flag("");
        expect(r.isErr()).toBe(true);
    });

    it("unflag() clears isFlagged and flagReason", () => {
        const flagged = unwrap(makeBooking()).flag("reason")._unsafeUnwrap();
        const unflagged = flagged.unflag();
        expect(unflagged.isFlagged).toBe(false);
        expect(unflagged.flagReason).toBeNull();
    });

    it("can flag a confirmed booking", () => {
        const confirmed = unwrap(makeBooking()).confirm()._unsafeUnwrap();
        expect(confirmed.flag("suspicious payment").isOk()).toBe(true);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// Immutability — entity trả về instance mới sau mỗi transition
// ═════════════════════════════════════════════════════════════════════════════
describe("Booking immutability", () => {
    it("confirm() returns a new instance, original unchanged", () => {
        const original = unwrap(makeBooking());
        const confirmed = original.confirm()._unsafeUnwrap();
        expect(original.status).toBe("pending");
        expect(confirmed.status).toBe("confirmed");
        expect(original).not.toBe(confirmed);
    });

    it("flag() returns a new instance, original unchanged", () => {
        const original = unwrap(makeBooking());
        const flagged = original.flag("reason")._unsafeUnwrap();
        expect(original.isFlagged).toBe(false);
        expect(flagged.isFlagged).toBe(true);
    });
});