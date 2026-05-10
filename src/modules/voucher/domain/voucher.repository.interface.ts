import { VoucherCampaignRow, NewVoucherCampaignRow } from "@/infrastructure/db/schema/vouchers";

export interface ListVouchersFilter {
    concertId?: string;
    page: number;
    limit: number;
}

export interface IVoucherRepository {
    findAll(filter: ListVouchersFilter): Promise<{ rows: VoucherCampaignRow[]; total: number }>;
    findById(id: string): Promise<VoucherCampaignRow | undefined>;
    findByCode(code: string): Promise<VoucherCampaignRow | undefined>;
    existsByCode(code: string): Promise<boolean>;
    save(data: NewVoucherCampaignRow): Promise<VoucherCampaignRow>;
    update(id: string, data: Partial<NewVoucherCampaignRow>): Promise<VoucherCampaignRow | undefined>;
    delete(id: string): Promise<boolean>;
}