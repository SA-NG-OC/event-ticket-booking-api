import { Router } from "express";
import { VoucherRepository } from "../infrastructure/voucher.repository";
import { ConcertRepository } from "@/modules/concert/infrastructure/concert.repository";
import { validate } from "@/shared/middleware/validate.middleware";
import { authenticate, requireAdmin } from "@/shared/middleware/auth.middleware";
import { VoucherService } from "../application/voucher.service";
import { VoucherController } from "./voucher.controller";
import { CreateVoucherSchema, DeleteVoucherSchema, ListVouchersSchema, PreviewVoucherSchema, UpdateVoucherSchema, VoucherIdSchema } from "./voucher.schema";

const router = Router();

const voucherRepo = new VoucherRepository();
const concertRepo = new ConcertRepository();
const voucherSvc = new VoucherService(voucherRepo, concertRepo);
const voucherCtrl = new VoucherController(voucherSvc);

// ── Customer (auth required — tránh scraping voucher codes) ───────────────
router.get("/preview", authenticate, validate(PreviewVoucherSchema), voucherCtrl.previewVoucher);

// ── Ops / Admin ────────────────────────────────────────────────────────────
router.post("/", authenticate, requireAdmin, validate(CreateVoucherSchema), voucherCtrl.createVoucher);
router.get("/", authenticate, requireAdmin, validate(ListVouchersSchema), voucherCtrl.listVouchers);
router.get("/:id", authenticate, requireAdmin, validate(VoucherIdSchema), voucherCtrl.getVoucherById);
router.patch("/:id", authenticate, requireAdmin, validate(UpdateVoucherSchema), voucherCtrl.updateVoucher);
router.delete("/:id", authenticate, requireAdmin, validate(DeleteVoucherSchema), voucherCtrl.deleteVoucher);

export { router as voucherRoutes };