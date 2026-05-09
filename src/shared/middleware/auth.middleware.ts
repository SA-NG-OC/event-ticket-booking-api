import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "@/config";

declare global {
    namespace Express {
        interface Request {
            user: {
                id: string;
                role: "customer" | "admin";
            };
        }
    }
}

interface JwtPayload {
    sub: string;
    role: "customer" | "admin";
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({
            success: false,
            code: "UNAUTHORIZED",
            message: "Missing or invalid Authorization header",
        });
        return;
    }

    const token = authHeader.slice(7);
    try {
        const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
        req.user = { id: payload.sub, role: payload.role };
        next();
    } catch (e) {
        if (e instanceof jwt.TokenExpiredError) {
            res.status(401).json({ success: false, code: "TOKEN_EXPIRED", message: "Token expired" });
        } else {
            res.status(401).json({ success: false, code: "TOKEN_INVALID", message: "Invalid token" });
        }
    }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (req.user?.role !== "admin") {
        res.status(403).json({
            success: false,
            code: "FORBIDDEN",
            message: "Admin access required",
        });
        return;
    }
    next();
}

export function requireCustomer(req: Request, res: Response, next: NextFunction) {
    if (req.user?.role !== "customer") {
        res.status(403).json({
            success: false,
            code: "FORBIDDEN",
            message: "Customer access required",
        });
        return;
    }
    next();
}