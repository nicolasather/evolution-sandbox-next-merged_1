# Phase 2 — việc CHỈ chủ sở hữu làm được (hướng dẫn từng bước, không cần biết lập trình)

Tất cả phần code đã xong và đã kiểm thử. Các mục dưới đây đang **BLOCKED** vì cần tài khoản/khóa của anh. **Đừng gửi khóa vào chat hay đưa vào git** — chỉ nhập vào Vercel > Settings > Environment Variables, và chỉ chọn môi trường **Preview**.

## Bước 0 — Đưa code lên GitHub (tạo nhánh riêng)
1. Mở **GitHub Desktop** → repo `evolution-sandbox-next-merged_1`.
2. Menu **Branch → New branch…** → tên `phase2-live-discovery` → Create.
3. Bên trái sẽ thấy ~120 file thay đổi. Ô **Summary** gõ: `Phase 2: live discovery sidecar (all flags OFF)` → **Commit to phase2-live-discovery**.
4. **Push origin**. Ghi mã commit (SHA, 7 ký tự đầu) vào bảng cuối `docs/PHASE2_STATUS.md`.
5. Chạy `npm install` một lần (có thêm thư viện mới: pg, zod, @anthropic-ai/sdk, @vercel/blob). Vercel sẽ tự làm khi build.
6. Kiểm tra nhanh trên máy: `npm run typecheck`, `npm test`, `npm run build`. (`npm run build` chưa chạy được trong môi trường của Claude vì chặn Google Fonts — đây là mục **NOT RUN** duy nhất cần anh xác nhận.)

## Bước 1 — Vercel Preview (KHÔNG phải Production)
Vercel tự tạo một địa chỉ Preview cho nhánh `phase2-live-discovery`. Mở địa chỉ đó: game phải chạy y hệt cũ (mọi cờ AI đang tắt). Đây là kiểm tra “AI tắt thì game không hỏng”.

## Bước 2 — Cơ sở dữ liệu (Neon, có gói miễn phí)
1. neon.tech → tạo project (vùng gần Việt Nam: Singapore) → copy **connection string** (dạng `postgres://…`).
2. Vercel → Settings → Environment Variables → thêm `DATABASE_URL` = chuỗi trên, **chỉ Preview**. Thêm `CREATIVE_AUTO_MIGRATE=true` (chỉ Preview; code từ chối tự migrate trên Production).
3. Thêm `ENABLE_DEV_TOOLS=true` và `OWNER_REVIEW_TOKEN` = một chuỗi ngẫu nhiên dài ≥ 32 ký tự (đây là “mật khẩu” duyệt bài; trang admin luôn đóng trên Production).
4. Redeploy Preview. Kiểm tra: mở `<preview>/api/admin/creative/metrics` bằng công cụ gửi header `Authorization: Bearer <token>` → phải trả JSON. (Không có token → 401.)
→ Khi xong, ticket 076 (cloud DB) đổi từ BLOCKED sang PASSED.

## Bước 3 — Khóa mô hình (tốn tiền thật, đặt trần nhỏ)
1. Tài khoản **API** (console.anthropic.com), KHÔNG phải gói chat Claude. Đặt **spend limit** 5 USD/tháng ở phía nhà cung cấp.
2. Lấy `ANTHROPIC_API_KEY`; vào danh sách model trong console, copy **đúng ID model hiện hành** → `CREATIVE_MODEL_ID`; copy giá vào `CREATIVE_PRICE_IN_PER_MTOK`, `CREATIVE_PRICE_OUT_PER_MTOK` (nếu bỏ trống, mỗi lần gọi bị tính ở mức tạm giữ = trường hợp xấu nhất).
3. Đặt `CREATIVE_DAILY_USD_CAP=0.50`, `CREATIVE_ACTOR_SALT` = chuỗi ngẫu nhiên, `CREATIVE_LLM_ENABLED=true`. Giữ `CREATIVE_PUBLIC_ROLLOUT=false` (chỉ anh thử).
4. Redeploy → thử một tổ hợp lạ nhưng “có lý” trong game → trong `.../proposals?status=pending` xuất hiện 1 đề xuất. Ghi lại request id vào STATUS (ticket 084/099).
5. Thử **kill switch** (xem `docs/LIVE_DISCOVERY_RUNBOOK.md`) và thử **rollback**.

## Bước 4 — 3D (tuỳ chọn)
`BLOB_READ_WRITE_TOKEN` (Vercel Storage → Blob), `ASSET_PROVIDER=meshy`, `MESHY_API_KEY`, `CRON_SECRET`, `ASSET_AI_ENABLED=true`. Mỗi bản 3D ~0.2 USD; mô hình tạo ra chỉ hiện sau khi anh duyệt. Có thể bỏ qua: game vẫn dùng hình dựng thủ tục.

## Bước 5 — Quyết định cần anh chốt (đúng 1 lần)
1. Nhà cung cấp & trần chi/ngày. 2. Dịch vụ lưu trữ staging. 3. Có dùng Meshy không. 4. Cách đăng nhập duyệt bài thật (hiện dùng token Bearer; muốn đăng nhập tài khoản + MFA thì cần chọn nhà cung cấp — ticket 086 phần đó). 5. Cho phép bật Production riêng (ký xác nhận riêng).

## Bảng trạng thái BLOCKED
| Mục | Cần gì | Ticket |
|---|---|---|
| Cloud DB thật | `DATABASE_URL` (Neon) | 076, 099 |
| Gọi LLM thật | key + model ID + trần | 084, 099 |
| Blob thật | `BLOB_READ_WRITE_TOKEN` | 092 |
| Meshy thật | key + chấp thuận chi phí | 090, 099 |
| Đăng nhập/MFA | chọn nhà cung cấp | 086 |
| Cảnh báo chi tiêu ngoài | cài ở nhà cung cấp | 100 |
| `next build`, click-test kéo-thả trên Preview | máy anh | 087 |
| Ký xác nhận Production | anh | 100 |
