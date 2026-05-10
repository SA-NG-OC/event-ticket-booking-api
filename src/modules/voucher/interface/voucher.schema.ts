import { z } from "zod";

export const CreateVoucherSchema = z.object({
    body: z.object({
        name: z.string().min(2).max(255),
        code: z.string().regex(
            /^[A-Z0-9_-]{3,50}$/,
            "Code must be 3–50 uppercase alphanumeric characters (A-Z, 0-9, _, -)"
        ),
        discountType: z.enum(["percentage", "fixed"]),
        discountValue: z.number().positive(),
        maxUses: z.number().int().min(1),
        minOrderValue: z.number().min(0).default(0),
        expiresAt: z.coerce.date().optional(),
        concertId: z.string().uuid().optional(),
    }).refine(
        (d) => !(d.discountType === "percentage" && d.discountValue > 100),
        { message: "Percentage discount cannot exceed 100", path: ["discountValue"] }
    ),
});

export const ListVouchersSchema = z.object({
    query: z.object({
        concertId: z.string().uuid().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
});

export const VoucherIdSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid voucher ID") }),
});

export const UpdateVoucherSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid voucher ID") }),
    body: z.object({
        name: z.string().min(2).max(255).optional(),
        maxUses: z.number().int().min(1).optional(),
        expiresAt: z.union([z.null(), z.coerce.date()]).optional(),
    }).refine(
        (d) => Object.keys(d).some(k => d[k as keyof typeof d] !== undefined),
        { message: "At least one field must be provided for update" }
    ),
});

export const DeleteVoucherSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid voucher ID") }),
});

export const PreviewVoucherSchema = z.object({
    query: z.object({
        code: z.string().min(1),
        orderAmount: z.coerce.number().positive("orderAmount must be positive"),
        concertId: z.string().uuid("Invalid concert ID"),
    }),
});