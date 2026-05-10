import { describe, it, expect } from "vitest";
import { Voucher } from "@/modules/voucher/domain/voucher.entity";

const CONCERT_A = "c1000000-0000-0000-0000-000000000001";
const CONCERT_B = "c2000000-0000-0000-0000-000000000002";

const FUTURE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1_000); // +1 năm
const PAST = new Date(Date.now() - 1_000);                        // 1 giây trước

// ── Factories ─────────────────────────────────────────────────────────────────
function makePercentageVoucher(overrides: Partial<Parameters<typeof Voucher.create>[0]> = {}) {
    return Voucher.create({
        id: "v1000000-0000-0000-0000-000000000001",
        name: "Test Voucher",
        code: "TEST10",
        discountType: "percentage",
        discountValue: 10,
        maxUses: 100,
        minOrderValue: 0,
        expiresAt: null,
        concertId: null,
        ...overrides,
    });
}

function makeFixedVoucher(overrides: Partial<Parameters<typeof Voucher.create>[0]> = {}) {
    return makePercentageVoucher({
        code: "FIXED50K",
        discountType: "fixed",
        discountValue: 50_000,
        ...overrides,
    });
}

function makeFromRow(overrides: Partial<Parameters<typeof Voucher.fromRow>[0]> = {}) {
    return Voucher.fromRow({
        id: "v1000000-0000-0000-0000-000000000001",
        name: "Test Voucher",
        code: "TEST10",
        discountType: "percentage",
        discountValue: 10,
        maxUses: 100,
        usedCount: 0,
        minOrderValue: 0,
        expiresAt: null,
        concertId: null,
        createdAt: new Date(),
        ...overrides,
    });
}

function unwrap(r: ReturnType<typeof Voucher.create>): Voucher {
    if (r.isErr()) throw new Error(`Unexpected Err: ${r.error.message}`);
    return r.value;
}

// ═════════════════════════════════════════════════════════════════════════════
// Voucher.create — validation
// ═════════════════════════════════════════════════════════════════════════════
describe("Voucher.create", () => {
    describe("name validation", () => {
        it("accepts name with 2+ chars", () => {
            expect(makePercentageVoucher({ name: "OK" }).isOk()).toBe(true);
        });

        it("rejects name shorter than 2 chars", () => {
            const r = makePercentageVoucher({ name: "X" });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().message).toMatch(/at least 2/);
        });

        it("rejects blank name", () => {
            expect(makePercentageVoucher({ name: "  " }).isErr()).toBe(true);
        });
    });

    describe("code validation", () => {
        it("accepts valid uppercase code", () => {
            expect(makePercentageVoucher({ code: "VALID_CODE-1" }).isOk()).toBe(true);
        });

        it("rejects lowercase code", () => {
            expect(makePercentageVoucher({ code: "lowercase" }).isErr()).toBe(true);
        });

        it("rejects code shorter than 3 chars", () => {
            expect(makePercentageVoucher({ code: "AB" }).isErr()).toBe(true);
        });

        it("rejects code with special characters", () => {
            expect(makePercentageVoucher({ code: "BAD CODE!" }).isErr()).toBe(true);
        });

        it("accepts 3-char code (min boundary)", () => {
            expect(makePercentageVoucher({ code: "ABC" }).isOk()).toBe(true);
        });

        it("accepts 50-char code (max boundary)", () => {
            expect(makePercentageVoucher({ code: "A".repeat(50) }).isOk()).toBe(true);
        });

        it("rejects 51-char code (over max)", () => {
            expect(makePercentageVoucher({ code: "A".repeat(51) }).isErr()).toBe(true);
        });
    });

    describe("percentage discount validation", () => {
        it("accepts 1% (min boundary)", () => {
            expect(makePercentageVoucher({ discountValue: 1 }).isOk()).toBe(true);
        });

        it("accepts 100% (max boundary)", () => {
            expect(makePercentageVoucher({ discountValue: 100 }).isOk()).toBe(true);
        });

        it("rejects 0%", () => {
            const r = makePercentageVoucher({ discountValue: 0 });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().message).toMatch(/between 1 and 100/);
        });

        it("rejects 101%", () => {
            expect(makePercentageVoucher({ discountValue: 101 }).isErr()).toBe(true);
        });

        it("rejects negative percentage", () => {
            expect(makePercentageVoucher({ discountValue: -10 }).isErr()).toBe(true);
        });
    });

    describe("fixed discount validation", () => {
        it("accepts positive fixed value", () => {
            expect(makeFixedVoucher({ discountValue: 1 }).isOk()).toBe(true);
        });

        it("rejects fixed = 0", () => {
            const r = makeFixedVoucher({ discountValue: 0 });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().message).toMatch(/greater than 0/);
        });

        it("rejects negative fixed value", () => {
            expect(makeFixedVoucher({ discountValue: -1 }).isErr()).toBe(true);
        });
    });

    describe("maxUses validation", () => {
        it("accepts maxUses = 1 (min)", () => {
            expect(makePercentageVoucher({ maxUses: 1 }).isOk()).toBe(true);
        });

        it("rejects maxUses = 0", () => {
            const r = makePercentageVoucher({ maxUses: 0 });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().message).toMatch(/at least 1/);
        });
    });

    describe("minOrderValue validation", () => {
        it("accepts minOrderValue = 0", () => {
            expect(makePercentageVoucher({ minOrderValue: 0 }).isOk()).toBe(true);
        });

        it("rejects negative minOrderValue", () => {
            const r = makePercentageVoucher({ minOrderValue: -1 });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().message).toMatch(/negative/);
        });
    });

    describe("expiresAt validation", () => {
        it("accepts null expiresAt (no expiry)", () => {
            expect(makePercentageVoucher({ expiresAt: null }).isOk()).toBe(true);
        });

        it("accepts future expiresAt", () => {
            expect(makePercentageVoucher({ expiresAt: FUTURE }).isOk()).toBe(true);
        });

        it("rejects past expiresAt", () => {
            const r = makePercentageVoucher({ expiresAt: PAST });
            expect(r.isErr()).toBe(true);
            expect(r._unsafeUnwrapErr().message).toMatch(/future/);
        });
    });

    describe("initial state", () => {
        it("usedCount starts at 0", () => {
            expect(unwrap(makePercentageVoucher()).usedCount).toBe(0);
        });

        it("remainingUses equals maxUses on creation", () => {
            const v = unwrap(makePercentageVoucher({ maxUses: 50 }));
            expect(v.remainingUses).toBe(50);
        });

        it("isExhausted is false on creation", () => {
            expect(unwrap(makePercentageVoucher()).isExhausted).toBe(false);
        });

        it("isExpired is false when expiresAt = null", () => {
            expect(unwrap(makePercentageVoucher({ expiresAt: null })).isExpired).toBe(false);
        });

        it("isExpired is false when expiresAt is in the future", () => {
            expect(unwrap(makePercentageVoucher({ expiresAt: FUTURE })).isExpired).toBe(false);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// Computed fields — fromRow (simulates DB state)
// ═════════════════════════════════════════════════════════════════════════════
describe("Voucher computed fields (fromRow)", () => {
    it("isExhausted = true when usedCount >= maxUses", () => {
        const v = makeFromRow({ maxUses: 10, usedCount: 10 });
        expect(v.isExhausted).toBe(true);
        expect(v.remainingUses).toBe(0);
    });

    it("isExhausted = false when usedCount < maxUses", () => {
        const v = makeFromRow({ maxUses: 10, usedCount: 9 });
        expect(v.isExhausted).toBe(false);
        expect(v.remainingUses).toBe(1);
    });

    it("isExpired = true when expiresAt is in the past", () => {
        const v = makeFromRow({ expiresAt: PAST });
        expect(v.isExpired).toBe(true);
    });

    it("isExpired = false when expiresAt is in the future", () => {
        const v = makeFromRow({ expiresAt: FUTURE });
        expect(v.isExpired).toBe(false);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// validate()
// ═════════════════════════════════════════════════════════════════════════════
describe("Voucher.validate()", () => {
    const now = new Date();

    it("passes for valid global voucher", () => {
        const v = makeFromRow();
        expect(v.validate({ orderAmount: 1_000_000, concertId: CONCERT_A, now }).isOk()).toBe(true);
    });

    it("fails when expired", () => {
        const v = makeFromRow({ expiresAt: PAST });
        const r = v.validate({ orderAmount: 1_000_000, concertId: CONCERT_A, now });
        expect(r.isErr()).toBe(true);
        expect(r._unsafeUnwrapErr().message).toMatch(/expired/);
    });

    it("fails when exhausted", () => {
        const v = makeFromRow({ maxUses: 5, usedCount: 5 });
        const r = v.validate({ orderAmount: 1_000_000, concertId: CONCERT_A, now });
        expect(r.isErr()).toBe(true);
        expect(r._unsafeUnwrapErr().message).toMatch(/maximum usage limit/);
    });

    it("fails when orderAmount < minOrderValue", () => {
        const v = makeFromRow({ minOrderValue: 500_000 });
        const r = v.validate({ orderAmount: 499_999, concertId: CONCERT_A, now });
        expect(r.isErr()).toBe(true);
        expect(r._unsafeUnwrapErr().message).toMatch(/Minimum order value/);
    });

    it("passes when orderAmount exactly equals minOrderValue", () => {
        const v = makeFromRow({ minOrderValue: 500_000 });
        expect(v.validate({ orderAmount: 500_000, concertId: CONCERT_A, now }).isOk()).toBe(true);
    });

    it("fails when scoped to different concert", () => {
        const v = makeFromRow({ concertId: CONCERT_A });
        const r = v.validate({ orderAmount: 1_000_000, concertId: CONCERT_B, now });
        expect(r.isErr()).toBe(true);
        expect(r._unsafeUnwrapErr().message).toMatch(/not valid for this concert/);
    });

    it("passes when scoped to same concert", () => {
        const v = makeFromRow({ concertId: CONCERT_A });
        expect(v.validate({ orderAmount: 1_000_000, concertId: CONCERT_A, now }).isOk()).toBe(true);
    });

    it("passes for any concert when concertId is null (global)", () => {
        const v = makeFromRow({ concertId: null });
        expect(v.validate({ orderAmount: 1_000_000, concertId: CONCERT_B, now }).isOk()).toBe(true);
    });

    it("checks multiple rules — expired takes priority over exhausted", () => {
        const v = makeFromRow({ expiresAt: PAST, maxUses: 5, usedCount: 5 });
        // Cả hai lỗi, nhưng expired được check trước
        const r = v.validate({ orderAmount: 1_000_000, concertId: CONCERT_A, now });
        expect(r._unsafeUnwrapErr().message).toMatch(/expired/);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// calculateDiscount()
// ═════════════════════════════════════════════════════════════════════════════
describe("Voucher.calculateDiscount()", () => {
    describe("percentage type", () => {
        it("10% of 1_000_000 = 100_000", () => {
            const v = makeFromRow({ discountType: "percentage", discountValue: 10 });
            expect(v.calculateDiscount(1_000_000)).toBe(100_000);
        });

        it("floors fractional result (no floating point leak)", () => {
            // 10% of 1_000_001 = 100_000.1 → floor → 100_000
            const v = makeFromRow({ discountType: "percentage", discountValue: 10 });
            expect(v.calculateDiscount(1_000_001)).toBe(100_000);
        });

        it("100% of any amount = full amount", () => {
            const v = makeFromRow({ discountType: "percentage", discountValue: 100 });
            expect(v.calculateDiscount(500_000)).toBe(500_000);
        });

        it("1% of 100 = 1", () => {
            const v = makeFromRow({ discountType: "percentage", discountValue: 1 });
            expect(v.calculateDiscount(100)).toBe(1);
        });
    });

    describe("fixed type", () => {
        it("deducts exactly the fixed amount", () => {
            const v = makeFromRow({ discountType: "fixed", discountValue: 50_000 });
            expect(v.calculateDiscount(1_000_000)).toBe(50_000);
        });

        it("caps at orderAmount when fixed > orderAmount", () => {
            const v = makeFromRow({ discountType: "fixed", discountValue: 200_000 });
            expect(v.calculateDiscount(100_000)).toBe(100_000);
        });

        it("returns 0 when orderAmount = 0", () => {
            const v = makeFromRow({ discountType: "fixed", discountValue: 50_000 });
            expect(v.calculateDiscount(0)).toBe(0);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// update()
// ═════════════════════════════════════════════════════════════════════════════
describe("Voucher.update()", () => {
    it("updates name only", () => {
        const v = makeFromRow();
        const r = v.update({ name: "New Name" });
        expect(r.isOk()).toBe(true);
        expect(r._unsafeUnwrap().name).toBe("New Name");
        expect(r._unsafeUnwrap().maxUses).toBe(v.maxUses); // unchanged
    });

    it("increases maxUses", () => {
        const v = makeFromRow({ maxUses: 50 });
        const r = v.update({ maxUses: 200 });
        expect(r.isOk()).toBe(true);
        expect(r._unsafeUnwrap().maxUses).toBe(200);
    });

    it("allows maxUses = usedCount (exact boundary)", () => {
        const v = makeFromRow({ maxUses: 10, usedCount: 8 });
        // maxUses = usedCount = 8 → allowed (voucher becomes exhausted but valid)
        expect(v.update({ maxUses: 8 }).isOk()).toBe(true);
    });

    it("rejects maxUses < usedCount", () => {
        const v = makeFromRow({ maxUses: 10, usedCount: 5 });
        const r = v.update({ maxUses: 4 });
        expect(r.isErr()).toBe(true);
        expect(r._unsafeUnwrapErr().type).toBe("BUSINESS_RULE");
        expect(r._unsafeUnwrapErr().message).toMatch(/usedCount \(5\)/);
    });

    it("sets expiresAt to a future date", () => {
        const v = makeFromRow({ expiresAt: null });
        const r = v.update({ expiresAt: FUTURE });
        expect(r.isOk()).toBe(true);
        expect(r._unsafeUnwrap().expiresAt).toEqual(FUTURE);
    });

    it("removes expiresAt by passing null", () => {
        const v = makeFromRow({ expiresAt: FUTURE });
        const r = v.update({ expiresAt: null });
        expect(r.isOk()).toBe(true);
        expect(r._unsafeUnwrap().expiresAt).toBeNull();
    });

    it("rejects past expiresAt", () => {
        const v = makeFromRow();
        const r = v.update({ expiresAt: PAST });
        expect(r.isErr()).toBe(true);
        expect(r._unsafeUnwrapErr().message).toMatch(/future/);
    });

    it("rejects short name", () => {
        const v = makeFromRow();
        expect(v.update({ name: "X" }).isErr()).toBe(true);
    });

    it("update() returns new instance — original unchanged", () => {
        const original = makeFromRow({ name: "Original" });
        const updated = original.update({ name: "Updated" })._unsafeUnwrap();
        expect(original.name).toBe("Original");
        expect(updated.name).toBe("Updated");
        expect(original).not.toBe(updated);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// canDelete()
// ═════════════════════════════════════════════════════════════════════════════
describe("Voucher.canDelete()", () => {
    it("allows delete when usedCount = 0", () => {
        const v = makeFromRow({ usedCount: 0 });
        expect(v.canDelete().isOk()).toBe(true);
    });

    it("rejects delete when usedCount = 1", () => {
        const v = makeFromRow({ usedCount: 1 });
        const r = v.canDelete();
        expect(r.isErr()).toBe(true);
        expect(r._unsafeUnwrapErr().type).toBe("BUSINESS_RULE");
        expect(r._unsafeUnwrapErr().message).toMatch(/been used 1 time/);
    });

    it("rejects delete when usedCount > 1 and shows correct count in message", () => {
        const v = makeFromRow({ usedCount: 42 });
        const r = v.canDelete();
        expect(r._unsafeUnwrapErr().message).toMatch(/42 time/);
    });
});