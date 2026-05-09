import { Request, Response } from "express";
import { ConcertService } from "../application/concert.service";
import { domainErrorToStatus } from "@/shared/result";

export class ConcertController {
    constructor(private readonly concertService: ConcertService) { }

    // ── Customer ──────────────────────────────────────────────────────────────
    listConcerts = async (req: Request, res: Response) => {
        const { status, page, limit } = req.query as any;
        const result = await this.concertService.listConcerts({ status, page: +page, limit: +limit });
        res.json({ success: true, data: result });
    };

    getConcertDetail = async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const result = await this.concertService.getConcertDetail(id);
        if (result.isErr()) {
            res.status(domainErrorToStatus(result.error)).json({ success: false, ...result.error });
            return;
        }
        res.json({ success: true, data: result.value });
    };

    // ── Ops ───────────────────────────────────────────────────────────────────
    createConcert = async (req: Request, res: Response) => {
        const result = await this.concertService.createConcert(req.body);
        if (result.isErr()) {
            res.status(domainErrorToStatus(result.error)).json({ success: false, ...result.error });
            return;
        }
        res.status(201).json({ success: true, data: result.value });
    };

    addTicketTiers = async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const result = await this.concertService.addTicketTiers(id, req.body.tiers);
        if (result.isErr()) {
            res.status(domainErrorToStatus(result.error)).json({ success: false, ...result.error });
            return;
        }
        res.status(201).json({ success: true, data: result.value });
    };

    publishConcert = async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const result = await this.concertService.publishConcert(id);
        if (result.isErr()) {
            res.status(domainErrorToStatus(result.error)).json({ success: false, ...result.error });
            return;
        }
        res.json({ success: true, data: result.value });
    };

    cancelConcert = async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const result = await this.concertService.cancelConcert(id);
        if (result.isErr()) {
            res.status(domainErrorToStatus(result.error)).json({ success: false, ...result.error });
            return;
        }
        res.json({ success: true, data: result.value });
    };

    checkAvailability = async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const result = await this.concertService.checkTicketAvailability(id);
        if (result.isErr()) {
            res.status(domainErrorToStatus(result.error)).json({ success: false, ...result.error });
            return;
        }
        res.json({ success: true, data: result.value });
    };
}