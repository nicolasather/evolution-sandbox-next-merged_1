# ANC27 V2 — thay đổi đã áp dụng (2026-10-15)

Nguồn hướng dẫn: Evolution_Sandbox_Claude_1999_Handoff.zip (+ bản handoff 1.999 bản ghi tải từ commit đã ghim; KHÔNG đưa file đó vào repo).

## Đã làm
1. Thay 10 mục trùng chức năng bằng mục mới (giữ nguyên `no`, tổng vẫn 1000, ID đổi theo idRemap, xem anc27_idRemap.json):
   - Bundle Reed Canoe -> Pitch-Sealed Hull Seam
   - Sea Depth Sounding Line -> Seabed Tallow Sampler
   - Winnowing Fan Basket -> Threshing Flail Flexible Joint
   - Rope Suspension Footbridge -> Timber Bridge Diagonal Brace
   - Stone Slab Ford Bridge -> Stone Ford Bank Retaining Apron
   - Reciprocating Force Pump -> Bronze Pump Check Valve
   - Workshop Quarter -> Potters Wheel Pivot Bearing (đổi chủ đề sang pottery_kilns)
   - Hand Spun Flax Yarn -> Flax Retting Stone Weight
   - Dugout River Canoe -> Fire-Hollowed Canoe Blank
   - Nubian Water Wheel -> Saqiya Pot-Chain Guide Wheel (đổi chủ đề sang hydraulic_machines_ancient)
2. Giữ 16 biến thể khác biệt (ví dụ Bronze/Iron Ploughshare), gắn trường `preservedDistinct`.
3. Mục thay thế dùng `physicalRoute` (chuỗi hành động có vật liệu) thay vì cặp ghép; `rec` để trống, `publish:false`, `adminApproved:false`.
4. Đổi toàn bộ tham chiếu ID cũ (công thức của 11 mục khác, gói chế độ chơi, CSV). Kiểm tra: 1000 ID duy nhất, 1000 tên duy nhất, số thứ tự 1920–2919 liên tục, 0 ID cũ còn sót (ngoài trường `replaces`).

## Chưa làm / bị chặn
- Nguồn theo từng mục: gần như chưa có. Theo handoff: 957/1000 mục anc27 đang `blocked` (815 khoá công thức trùng), 30 `review`, 13 `candidate`.
- Công thức hành động nhiều bước: engine hiện chỉ hỗ trợ ghép 2–5 vật; cần mở rộng (route có thứ tự bước).
- Cơ chế `fish` chưa có (cần sửa lib/types.ts, processing/techniques.ts, craft/kinds.ts, engine, test).
- Mô hình 3D: 0/1000 anc27 đã duyệt.
- Chưa chạy typecheck, lint, test, build (shell trên máy không khởi động); chưa tạo nhánh review; không merge vào main.
