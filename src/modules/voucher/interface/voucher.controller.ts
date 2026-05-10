import { Request, Response } from "express";
import { VoucherService } from "../application/voucher.service";
import { domainErrorToStatus } from "@/shared/result";

export class VoucherController {
    constructor(private readonly voucherService: VoucherService) { }

    // ── Ops ───────────────────────────────────────────────────────────────────
    createVoucher = async (req: Request, res: Response) => {
        const result = await this.voucherService.createVoucher(req.body);
        if (result.isErr()) {
            res.status(domainErrorToStatus(result.error)).json({ success: false, ...result.error });
            return;
        }
        res.status(201).json({ success: true, data: result.value });
    };

    listVouchers = async (req: Request, res: Response) => {
        const { concertId, page, limit } = req.query as any;
        const result = await this.voucherService.listVouchers({
            concertId,
            page: +page,
            limit: +limit,
        });
        res.json({ success: true, data: result });
    };

    getVoucherById = async (req: Request, res: Response) => {
        const result = await this.voucherService.getVoucherById(req.params.id as string);
        if (result.isErr()) {
            res.status(domainErrorToStatus(result.error)).json({ success: false, ...result.error });
            return;
        }
        res.json({ success: true, data: result.value });
    };

    updateVoucher = async (req: Request, res: Response) => {
        const result = await this.voucherService.updateVoucher(req.params.id as string, req.body);
        if (result.isErr()) {
            res.status(domainErrorToStatus(result.error)).json({ success: false, ...result.error });
            return;
        }
        res.json({ success: true, data: result.value });
    };

    deleteVoucher = async (req: Request, res: Response) => {
        const result = await this.voucherService.deleteVoucher(req.params.id as string);
        if (result.isErr()) {
            res.status(domainErrorToStatus(result.error)).json({ success: false, ...result.error });
            return;
        }
        res.status(204).send();
    };

    // ── Customer ──────────────────────────────────────────────────────────────
    previewVoucher = async (req: Request, res: Response) => {
        const { code, orderAmount, concertId } = req.query as any;
        const result = await this.voucherService.previewVoucher({
            code,
            orderAmount: +orderAmount,
            concertId,
        });
        if (result.isErr()) {
            res.status(domainErrorToStatus(result.error)).json({ success: false, ...result.error });
            return;
        }
        res.json({ success: true, data: result.value });
    };
}