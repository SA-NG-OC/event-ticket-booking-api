import { Request, Response, NextFunction } from "express";
import { AuthService } from "../application/auth.service";
import { domainErrorToStatus } from "@/shared/result";

export class AuthController {
    constructor(private readonly authService: AuthService) { }

    register = async (req: Request, res: Response, next: NextFunction) => {
        const result = await this.authService.register(req.body);
        if (result.isErr()) {
            const status = domainErrorToStatus(result.error);
            res.status(status).json({ success: false, ...result.error });
            return;
        }
        res.status(201).json({ success: true, data: result.value });
    };

    login = async (req: Request, res: Response, next: NextFunction) => {
        const result = await this.authService.login(req.body);
        if (result.isErr()) {
            const status = domainErrorToStatus(result.error);
            res.status(status).json({ success: false, ...result.error });
            return;
        }
        res.status(200).json({ success: true, data: result.value });
    };

    me = async (req: Request, res: Response) => {
        res.status(200).json({ success: true, data: req.user });
    };
}