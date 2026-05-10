# Nguyên tắc & Quy ước Viết Code

> Concert Booking Platform — Backend

---

## Thêm một API mới — Checklist theo thứ tự

```
1. domain/         — Entity method hoặc interface update
2. domain/         — IRepository: thêm method signature nếu cần
3. infrastructure/ — Repository: implement method mới
4. application/    — Service: business logic, gọi repo, trả Result<T>
5. interface/      — Zod schema validation
6. interface/      — Controller method (unwrap Result → HTTP response)
7. interface/      — Route: wire middleware + controller
8. docs/           — Cập nhật YAML file tương ứng
9. tests/          — Viết test case
```

---

## Pattern nhất quán trong mọi module

### Repository — chỉ CRUD, trả raw DB row

```typescript
// ✅ Đúng
async findById(id: string): Promise<UserRow | undefined>

// ❌ Sai — repo không throw DomainError
async findById(id: string): Promise<Result<User, DomainError>>
```

### Service — nhận raw row từ repo, reconstruct entity, xử lý business logic

```typescript
const row = await this.repo.findById(id);
if (!row) return err(DomainErrors.notFound("Resource")); // service quyết định lỗi gì

const entity = MyEntity.fromRow(row);                    // reconstruct entity
const result = entity.someTransition();                  // domain logic
if (result.isErr()) return err(result.error);

const updated = await this.repo.update(id, result.value.toPersistence());
return ok(updated);
```

### Entity — constructor private, chỉ tạo qua static factory

```typescript
// ✅ Tạo mới — có validation, trả Result
const result = MyEntity.create({ ... });   // Result<MyEntity, DomainError>

// ✅ Reconstruct từ DB — không validate lại
const entity = MyEntity.fromRow(dbRow);   // MyEntity (không fail)

// ✅ State transition — trả Result để caller xử lý
const next = entity.someTransition();     // Result<MyEntity, DomainError>
```

### Controller — không có try/catch, không có business logic

```typescript
myAction = async (req: Request, res: Response) => {
  const result = await this.service.doSomething(req.body);
  if (result.isErr()) {
    res.status(domainErrorToStatus(result.error))
       .json({ success: false, ...result.error });
    return;
  }
  res.status(201).json({ success: true, data: result.value });
};
```

---

## Numeric Fields từ Drizzle

PostgreSQL `numeric` column trả về `string` từ pg driver. Convention trong project:

```typescript
// Khi đọc từ DB row → entity
price: Number(row.price)

// Khi persist entity → DB
price: String(entity.price)
```

---

## Error HTTP Mapping

| DomainError type  | HTTP status |
|-------------------|-------------|
| `NOT_FOUND`       | 404         |
| `CONFLICT`        | 409         |
| `VALIDATION`      | 400         |
| `BUSINESS_RULE`   | 422         |
| `FORBIDDEN`       | 403         |
| `UNAUTHORIZED`    | 401         |

---

## Chạy Tests

### Thiết lập test DB (chỉ cần làm 1 lần)

```bash
# Khởi động PostgreSQL test riêng biệt (port 5434)
docker compose -f docker-compose.test.yml up -d

# Chạy migration lên test DB
npm run db:migrate:test
```

> **Lưu ý:** Integration tests dùng real PostgreSQL (port 5434) và real Redis. Đảm bảo cả hai đang chạy trước khi chạy test.

### Lệnh chạy test

```bash
# Chạy toàn bộ test suite
npm test

# Watch mode — tự re-run khi save file
npm run test:watch

# Với coverage report
npm run test:coverage

# Chạy 1 file test cụ thể
npm test tests/integration/booking.test.ts
npm test tests/integration/voucher.test.ts
```

### Xem test DB bằng Drizzle Studio

```bash
npm run studio:test
# Mở http://localhost:4984
```