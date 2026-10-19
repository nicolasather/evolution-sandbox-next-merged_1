# Developer Beta — hướng dẫn cài đặt và sử dụng

Bản beta là một bản triển khai **riêng** của Evolution Sandbox, chỉ dành cho người test. Nó cho phép vào mọi mode / chương / vật phẩm mà không phải chơi tuần tự. Người chơi thật (nhánh `main`, bản production) **không thấy và không kích hoạt được** bất cứ thứ gì ở đây.

## 1. Kiến trúc (3 lớp tách biệt)

| Khái niệm | Nằm ở đâu | Ghi chú |
|---|---|---|
| Bản ghi hoàn thành / khám phá (save của game) | localStorage `evo.*` | Không bị override sửa, trừ khi tester chủ động dùng công cụ cấp phát |
| Developer override (công tắc) | `evo.dev.v1` + `lib/dev/overrides.ts` | Chỉ đổi cái gì **mở được**, không bao giờ ghi vào save |
| Save của beta | cùng khóa `evo.*` nhưng trong namespace `evo-beta:` | Tách khỏi production (xem §4) |

Override chỉ có hiệu lực khi **cả ba** đúng: (1) build là beta (`NEXT_PUBLIC_ENABLE_DEV_TOOLS=true` và không phải deploy production), (2) máy chủ trả 200 cho `GET /api/dev/status` (cần `ENABLE_DEV_TOOLS=true`, `VERCEL_ENV` khác `production`), (3) tester bật công tắc. URL, cookie, localStorage **không bao giờ** được đọc để cấp quyền.

## 2. Cài đặt trên Vercel (làm tay — Claude không đụng cấu hình Vercel)

1. Project Settings → Git: **Production Branch = `main`** (giữ nguyên). Root Directory = `merged`.
2. Settings → Environment Variables, thêm 2 biến:
   - `NEXT_PUBLIC_ENABLE_DEV_TOOLS` = `true`
   - `ENABLE_DEV_TOOLS` = `true`

   Với mỗi biến: **bỏ chọn Production**, chọn **Preview**, rồi chọn *Select a custom Preview branch* → `beta`. Không đặt cho Development nếu không cần.
3. Settings → Deployment Protection: bật **Vercel Authentication** cho *Preview deployments* (hoặc "Standard Protection"). Chỉ thành viên team đăng nhập Vercel mới mở được URL beta.
4. Push nhánh `beta` → Vercel tự tạo Preview. URL ổn định của nhánh: Dashboard → Deployments → lọc branch `beta` → nút Domains/“Visit” (dạng `<project>-git-beta-<team>.vercel.app`).
5. Kiểm tra sau deploy:
   - `https://<beta-url>/api/dev/status` → JSON `{"enabled":true,...}` (khi đã đăng nhập Vercel).
   - `https://<production-url>/api/dev/status` → **404**.
   - Trang production không có nút `DEV` và không có console.

> Lưu ý: Sentry/GA: bản beta tắt GA, Analytics, SpeedInsights và đặt `noindex`. Nếu bạn đặt `SENTRY_DSN` cho Preview, lỗi của beta sẽ đi vào cùng project Sentry — hãy dùng DSN riêng hoặc bỏ cho Preview.

## 3. Quy trình làm việc

- `main` = production. Không merge nhánh `beta` vào `main` nếu chưa tách các commit dev ra (code dev vô hại trên production — bị loại khỏi bundle và API trả 404 — nhưng vẫn nên review).
- Sửa game ở `main` → `git checkout beta && git merge main` để beta luôn có bản mới nhất.
- Lệnh chạy local để thử beta:
  ```
  NEXT_PUBLIC_ENABLE_DEV_TOOLS=true ENABLE_DEV_TOOLS=true npm run dev
  ```
  (Windows PowerShell: `$env:NEXT_PUBLIC_ENABLE_DEV_TOOLS="true"; $env:ENABLE_DEV_TOOLS="true"; npm run dev`)

## 4. Cô lập save

- Khác origin (URL preview ≠ URL production) → trình duyệt đã tách localStorage.
- Lớp bảo vệ thứ hai: script chạy đầu trang (chỉ trong build beta) đổi `window.localStorage` thành bản có tiền tố `evo-beta:`. Beta không đọc/ghi được khóa production dù có chung origin; ngược lại cũng vậy.
- Nếu console báo “Lưu trữ beta: KHÔNG hoạt động”, các thao tác ghi/xóa save bị **từ chối**.

## 5. Hướng dẫn dùng console

Mở: nút cam **DEV BETA** ở góc trái dưới. **Alt+Shift+D** hoặc nút “Ẩn” để ẩn tức thì (còn một chấm `DEV` nhỏ để mở lại). Trạng thái ẩn nhớ theo trình duyệt.

| Tab | Chức năng |
|---|---|
| Trạng thái | Môi trường, nhánh, commit, mode hiện tại, số phát hiện/era của Main Evolution, chương Civilization, trạng thái xác thực với server |
| Công tắc | Mở khóa mọi mode/tính năng; bỏ qua thứ tự thời đại & thứ tự chương; bỏ qua intro/cinematic; hiện toàn bộ node khám phá; tốc độ hoạt ảnh (0.5×–10×); seed cố định cho các mode procedural (Survival, Archaeologist, Decipher, Alien, Reverse); khôi phục mặc định |
| Mode | Vào thẳng mọi mode trong registry thật; Civilization: chọn chương 1–24 và vào thẳng; đánh dấu các chương trước là “đã hoàn thành” (ghi chú `runId: dev-scenario`, tách rõ khỏi chơi thật) |
| Kịch bản | Early (~25 phát hiện) / Middle (hết Civilization, ~786) / Late (~918): chơi tự động qua chính Engine nên mọi phát hiện có công thức thật |
| Nội dung | Tìm & cấp phát vật phẩm/phát hiện, cấp kỹ thuật, liệt kê node chưa tìm |
| Save | Xuất / nhập file save beta, reset từng mode, reset toàn bộ beta, khôi phục bản sao lưu (mọi thao tác phá hủy đều sao lưu trước và cần bấm xác nhận 2 lần) |
| Lỗi | Lỗi JS / unhandled rejection / console.error đã bắt được |

Tắt công tắc không làm hỏng save: override không bao giờ nằm trong save; tắt chỉ khiến những thứ chưa đạt tiến trình thật bị khóa lại, còn dữ liệu đã có giữ nguyên.

## 6. Giới hạn đã biết

- Tốc độ chỉ chia nhịp hoạt ảnh trực quan (CSS/Web Animations), không đổi tốc độ mô phỏng game.
- Vật phẩm cấp qua tab Nội dung không có “bước công thức” (kịch bản fast-forward thì có).
- Sự kiện `storage` giữa các tab mang khóa có tiền tố; Lifelines dùng BroadcastChannel/Web Locks nên vẫn hoạt động.
- Bundle production được xác minh loại bỏ console bằng webpack (`next build --webpack`). Vercel mặc định dùng Turbopack; ngay cả nếu chunk còn trong bundle, nó vẫn **vô hiệu** vì API trả 404 và override chỉ bật khi server đồng ý. Nên grep bản build thật sau lần deploy đầu.
- Chưa kiểm chứng trên Vercel thật (không có quyền truy cập từ môi trường này).
