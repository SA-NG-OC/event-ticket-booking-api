import { ConcertProps, TicketTierProps } from "../domain/concert.entity";

export interface CreateConcertDto {
    name: string;
    description?: string;
    venue: string;
    artistName: string;
    eventDate: Date;
}

export interface AddTicketTierDto {
    name: string;
    price: number;
    totalQty: number;
}

export type ConcertView = ConcertProps;
export type TicketTierView = TicketTierProps & { availableQty: number };