import { Router } from "express";
import { ConcertRepository, TicketTierRepository } from "../infrastructure/concert.repository";
import { validate } from "@/shared/middleware/validate.middleware";
import { authenticate, requireAdmin } from "@/shared/middleware/auth.middleware";
import { ConcertService } from "../application/concert.service";
import { ConcertController } from "./concert.controller";
import { AddTicketTiersSchema, ConcertIdSchema, CreateConcertSchema, ListConcertsSchema } from "./concert.schema";

const router = Router();

const concertRepo = new ConcertRepository();
const ticketTierRepo = new TicketTierRepository();
const concertSvc = new ConcertService(concertRepo, ticketTierRepo);
const concertCtrl = new ConcertController(concertSvc);

// ── Customer routes (public — không cần auth) ─────────────────────────────
router.get("/", validate(ListConcertsSchema), concertCtrl.listConcerts);
router.get("/:id", validate(ConcertIdSchema), concertCtrl.getConcertDetail);
router.get("/:id/availability", validate(ConcertIdSchema), concertCtrl.checkAvailability);

// ── Ops routes (admin only) ───────────────────────────────────────────────
router.post("/", authenticate, requireAdmin, validate(CreateConcertSchema), concertCtrl.createConcert);
router.post("/:id/tiers", authenticate, requireAdmin, validate(AddTicketTiersSchema), concertCtrl.addTicketTiers);
router.patch("/:id/publish", authenticate, requireAdmin, validate(ConcertIdSchema), concertCtrl.publishConcert);
router.patch("/:id/cancel", authenticate, requireAdmin, validate(ConcertIdSchema), concertCtrl.cancelConcert);

export { router as concertRoutes };