import { v4 as uuidv4 } from "uuid";
import { ok, err, Result, DomainErrors, DomainError } from "@/shared/result";
import { Voucher } from "../domain/voucher.entity";
import { IVoucherRepository, ListVouchersFilter } from "../domain/voucher.repository.interface";
import { IConcertRepository } from "@/modules/concert/domain/concert.repository.interface";
import { CreateVoucherDto, UpdateVoucherDto, PreviewVoucherDto, VoucherView, VoucherPreview } from "./voucher.dto";
import { toView, toNumericProps } from "./voucher.mapper";

export type { CreateVoucherDto, UpdateVoucherDto, PreviewVoucherDto, VoucherView, VoucherPreview };

export class VoucherService {
    constructor(
        private readonly voucherRepo: IVoucherRepository,
        private readonly concertRepo: IConcertRepository,
    ) { }

    // ── Ops: Tạo voucher campaign ─────────────────────────────────────────────
    async createVoucher(dto: CreateVoucherDto): Promise<Result<VoucherView, DomainError>> {
        const exists = await this.voucherRepo.existsByCode(dto.code);
        if (exists) {
            return err(DomainErrors.conflict(`Voucher code '${dto.code.toUpperCase()}' already exists`));
        }

        if (dto.concertId) {
            const concert = await this.concertRepo.findById(dto.concertId);
            if (!concert) return err(DomainErrors.notFound("Concert"));
        }

        const result = Voucher.create({
            id: uuidv4(),
            name: dto.name,
            code: dto.code,
            discountType: dto.discountType,
            discountValue: dto.discountValue,
            maxUses: dto.maxUses,
            minOrderValue: dto.minOrderValue,
            expiresAt: dto.expiresAt ?? null,
            concertId: dto.concertId ?? null,
        });
        if (result.isErr()) return err(result.error);

        const voucher = result.value;
        try {
            const row = await this.voucherRepo.save({
                ...voucher.toPersistence(),
                discountValue: String(voucher.discountValue),
                minOrderValue: String(voucher.minOrderValue),
            });
            return ok(toView(Voucher.fromRow(toNumericProps(row))));
        } catch (e: any) {
            if (e?.code === "23505") {
                return err(DomainErrors.conflict(`Voucher code '${dto.code.toUpperCase()}' already exists`));
            }
            throw e;
        }
    }

    // ── Ops: Danh sách campaigns ──────────────────────────────────────────────
    async listVouchers(filter: ListVouchersFilter): Promise<{
        vouchers: VoucherView[];
        total: number;
        page: number;
        limit: number;
    }> {
        const { rows, total } = await this.voucherRepo.findAll(filter);
        return {
            vouchers: rows.map(r => toView(Voucher.fromRow(toNumericProps(r)))),
            total,
            page: filter.page,
            limit: filter.limit,
        };
    }

    // ── Ops: Detail 1 campaign ────────────────────────────────────────────────
    async getVoucherById(id: string): Promise<Result<VoucherView, DomainError>> {
        const row = await this.voucherRepo.findById(id);
        if (!row) return err(DomainErrors.notFound("Voucher campaign"));
        return ok(toView(Voucher.fromRow(toNumericProps(row))));
    }

    // ── Ops: Update voucher ───────────────────────────────────────────────────
    async updateVoucher(id: string, dto: UpdateVoucherDto): Promise<Result<VoucherView, DomainError>> {
        const row = await this.voucherRepo.findById(id);
        if (!row) return err(DomainErrors.notFound("Voucher campaign"));

        const voucher = Voucher.fromRow(toNumericProps(row));

        const updateResult = voucher.update({
            name: dto.name,
            maxUses: dto.maxUses,
            expiresAt: dto.expiresAt,
        });
        if (updateResult.isErr()) return err(updateResult.error);

        const updated = updateResult.value;
        const persisted = updated.toPersistence();

        const updatedRow = await this.voucherRepo.update(id, {
            name: persisted.name,
            maxUses: persisted.maxUses,
            expiresAt: persisted.expiresAt,
        });
        if (!updatedRow) return err(DomainErrors.notFound("Voucher campaign"));

        return ok(toView(Voucher.fromRow(toNumericProps(updatedRow))));
    }

    // ── Ops: Delete voucher ───────────────────────────────────────────────────
    async deleteVoucher(id: string): Promise<Result<void, DomainError>> {
        const row = await this.voucherRepo.findById(id);
        if (!row) return err(DomainErrors.notFound("Voucher campaign"));

        const voucher = Voucher.fromRow(toNumericProps(row));

        const canDelete = voucher.canDelete();
        if (canDelete.isErr()) return err(canDelete.error);

        await this.voucherRepo.delete(id);
        return ok(undefined);
    }

    // ── Customer: Preview discount trước khi booking ──────────────────────────
    async previewVoucher(dto: PreviewVoucherDto): Promise<Result<VoucherPreview, DomainError>> {
        const row = await this.voucherRepo.findByCode(dto.code);
        if (!row) return err(DomainErrors.notFound("Voucher"));

        const voucher = Voucher.fromRow(toNumericProps(row));

        const validation = voucher.validate({
            orderAmount: dto.orderAmount,
            concertId: dto.concertId,
        });
        if (validation.isErr()) return err(validation.error);

        const discountAmount = voucher.calculateDiscount(dto.orderAmount);
        const finalAmount = dto.orderAmount - discountAmount;

        const description =
            voucher.discountType === "percentage"
                ? `${voucher.discountValue}% off`
                : `${voucher.discountValue.toLocaleString("vi-VN")} VND off`;

        return ok({ code: voucher.code, discountType: voucher.discountType, discountAmount, finalAmount, description });
    }
}