import { TicketTier } from "../domain/concert.entity";
import { TicketTierView } from "./concert.dto";

export function toTierView(tier: TicketTier): TicketTierView {
    return { ...tier.toPersistence(), availableQty: tier.availableQty };
}