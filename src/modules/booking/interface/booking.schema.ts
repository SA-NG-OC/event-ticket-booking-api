
import { z } from "zod";

export const CreateBookingSchema = z.object({
    body: z.object({
        ticketTierId: z.string().uuid("Invalid ticket tier ID"),
        quantity: z.number().int().min(1).max(10),
        voucherCode: z.string().min(1).max(50).optional(),
        idempotencyKey: z.string().uuid("idempotencyKey must be a UUID"),
    }),
});

export const BookingIdSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid booking ID") }),
});

export const ListBookingsSchema = z.object({
    query: z.object({
        userId: z.string().uuid().optional(),
        concertId: z.string().uuid().optional(),
        status: z.enum(["pending", "confirmed", "cancelled", "failed"]).optional(),
        isFlagged: z.enum(["true", "false"]).transform(v => v === "true").optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
});

export const UpdateStatusSchema = z.object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
        status: z.enum(["confirmed", "cancelled", "failed"]),
    }),
});

export const FlagBookingSchema = z.object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
        reason: z.string().min(1).max(500),
    }),
});