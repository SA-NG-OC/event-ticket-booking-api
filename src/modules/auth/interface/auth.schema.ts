import { z } from "zod";

export const RegisterSchema = z.object({
    body: z.object({
        email: z.email(),
        password: z.string().min(8, "Password must be at least 8 characters"),
        name: z.string().min(2).max(100),
    }),
});

export const LoginSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(1),
    }),
});