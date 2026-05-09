import { Request, Response } from "express";
import { BookingService } from "../application/booking.service";
import { domainErrorToStatus } from "@/shared/result";

export class BookingController {
    constructor(private readonly bookingService: BookingService) { }

    // ── Customer ──────────────────────────────────────────────────────────────
    createBooking = async (req: Request, res: Response) => {
        const result = await this.bookingService.createBooking({
            ...req.body,
            userId: req.user.id,
        });
        if (result.isErr()) {
            res.status(domainErrorToStatus(result.error)).json({ success: false, ...result.error });
            return;
        }
        res.status(201).json({ success: true, data: result.value });
    };

    getMyBookings = async (req: Request, res: Response) => {
        const { page, limit } = req.query as any;
        const result = await this.bookingService.getMyBookings(req.user.id, +page || 1, +limit || 20);
        res.json({ success: true, data: result });
    };

    getBookingById = async (req: Request, res: Response) => {
        const result = await this.bookingService.getBookingById(
            req.params.id as string,
            req.user.id,
            req.user.role === "admin",
        );
        if (result.isErr()) {
            res.status(domainErrorToStatus(result.error)).json({ success: false, ...result.error });
            return;
        }
        res.json({ success: true, data: result.value });
    };

    cancelMyBooking = async (req: Request, res: Response) => {
        const result = await this.bookingService.cancelMyBooking(req.params.id as string, req.user.id);
        if (result.isErr()) {
            res.status(domainErrorToStatus(result.error)).json({ success: false, ...result.error });
            return;
        }
        res.json({ success: true, data: result.value });
    };

    // ── Ops / Admin ───────────────────────────────────────────────────────────
    listAllBookings = async (req: Request, res: Response) => {
        const { userId, concertId, status, isFlagged, page, limit } = req.query as any;
        const result = await this.bookingService.listAllBookings({
            userId, concertId, status,
            isFlagged: isFlagged !== undefined ? isFlagged === "true" : undefined,
            page: +page || 1,
            limit: +limit || 20,
        });
        res.json({ success: true, data: result });
    };

    updateBookingStatus = async (req: Request, res: Response) => {
        const result = await this.bookingService.updateBookingStatus(req.params.id as string, req.body);
        if (result.isErr()) {
            res.status(domainErrorToStatus(result.error)).json({ success: false, ...result.error });
            return;
        }
        res.json({ success: true, data: result.value });
    };

    flagBooking = async (req: Request, res: Response) => {
        const result = await this.bookingService.flagBooking(req.params.id as string, req.body.reason);
        if (result.isErr()) {
            res.status(domainErrorToStatus(result.error)).json({ success: false, ...result.error });
            return;
        }
        res.json({ success: true, data: result.value });
    };

    unflagBooking = async (req: Request, res: Response) => {
        const result = await this.bookingService.unflagBooking(req.params.id as string);
        if (result.isErr()) {
            res.status(domainErrorToStatus(result.error)).json({ success: false, ...result.error });
            return;
        }
        res.json({ success: true, data: result.value });
    };
}