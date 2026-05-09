import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app.error";

export function errorMiddleware(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    // Zod validation error
    if (err instanceof ZodError) {
        res.status(400).json({
            success: false,
            code: "VALIDATION_ERROR",
            errors: err.flatten().fieldErrors,
        });
        return;
    }

    // Known application error
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            code: err.code,
            message: err.message,
        });
        return;
    }

    // Unknown error
    console.error("Unhandled error:", err);
    res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
    });
}