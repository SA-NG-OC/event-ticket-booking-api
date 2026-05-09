import { z } from "zod";

export const ListConcertsSchema = z.object({
    query: z.object({
        status: z.enum(["draft", "on_sale", "sold_out", "cancelled", "completed"]).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
});

export const ConcertIdSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid concert ID") }),
});

export const CreateConcertSchema = z.object({
    body: z.object({
        name: z.string().min(3).max(255),
        description: z.string().max(2000).optional(),
        venue: z.string().min(2).max(255),
        artistName: z.string().min(1).max(255),
        eventDate: z.coerce.date(),
    }),
});

export const AddTicketTiersSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid concert ID") }),
    body: z.object({
        tiers: z.array(z.object({
            name: z.string().min(1).max(100),
            price: z.number().positive(),
            totalQty: z.number().int().positive(),
        })).min(1, "At least one tier required"),
    }),
});