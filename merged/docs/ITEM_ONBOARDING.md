# Thêm vật phẩm mới → AI tự lo 3D, công thức thay thế và chế độ chơi

## Anh chỉ cần đưa cho Claude (không phải sửa code)
Mỗi vật phẩm mới: **tên**, **mô tả**, **thời đại/năm**, **1 nguồn** (một đường dẫn hoặc tên sách/bảo tàng) và **ĐÚNG 1 công thức** (nguyên liệu + hành động). Claude Code ghi vào `data/verified_seeds/<lô>.json` + file anchor, chạy `content:run` → `publish` → `data:build` (quy trình Phase 1, mọi luật cứng vẫn áp dụng: đúng thời đại, đúng vật lý, không tự bịa vật phẩm).

**Vì sao cần 1 nguồn?** Vật phẩm không có nguồn thật bị đánh dấu `pending`. Hệ thống cố ý **từ chối** đưa nó cho AI (3D, công thức, chế độ chơi) — để AI không “vẽ” và “chế” cho thứ chưa được xác thực. Có nguồn → vật phẩm thành `verified` và mọi thứ dưới đây tự chạy.

## Sau khi vật phẩm vào game
| Việc | Có tự động? | Cách hoạt động | Ai quyết định cuối |
|---|---|---|---|
| Đăng ký vật phẩm vào hệ thống AI | Tự động | Mỗi lần server khởi động (`importApprovedRefs`) | — |
| Mô hình 3D | Tự động xếp hàng | Brief chỉ gồm tên + chất liệu + thẻ + dòng mô tả đầu của anh, cùng một câu phong cách cố định (“một vật thể, kiểu bảo tàng, không chữ, không logo”) nên giống các vật có sẵn | Anh xem và duyệt từng mô hình; chưa duyệt thì game vẫn dùng hình dựng thủ tục |
| Công thức thay thế (tối đa 3/vật phẩm) | Tự động đề xuất | AI chỉ chọn trong danh sách nguyên liệu hợp thời đại; mỗi đề xuất phải qua kiểm tra cấu trúc **và** cổng vật lý/quy trình của máy chủ | Anh duyệt → xuất bản bản phát hành → mới lên game |
| Chế độ chơi (Survival, Archaeology, …) | Tự vào kho | Bộ lọc của từng chế độ đọc dữ liệu: vật phẩm đủ điều kiện tự có mặt trong danh sách 10–30 vật phẩm mà chế độ cung cấp cho AI | Gói chế độ chơi vẫn do anh duyệt (nút trong admin); Bảo tàng Nhân loại **không bao giờ** do AI thêm |

## Nút bấm (không cần gõ lệnh)
Trang `/admin/recipes` (chỉ có trên Preview/máy local, đóng trên production) → khung **“Vật phẩm mới cần xử lý”** → nhập mã chủ sở hữu → **Xem vật phẩm mới** / **Xử lý tối đa 3 vật phẩm**. Mỗi lần bấm tối đa 3 vật phẩm, mỗi vật phẩm 1 lần gọi AI (~vài cent), bị chặn bởi trần chi tiêu ngày và kill switch. Lỗi AI tạm thời → vật phẩm vẫn “mới” và được thử lại sau, không bị ghi nhớ như một kết luận.

Muốn chạy tự động theo lịch: đặt `CRON_SECRET` và thêm cron của Vercel gọi `/api/internal/onboard/tick` (mỗi lần 1 vật phẩm). Lưu ý cron của Vercel chỉ chạy trên Production; ở bước thử, dùng nút.

## Giới hạn trung thực
* “Tự động” nghĩa là **tự đề xuất và tự xếp hàng**, không phải tự xuất bản. Đây là luật của Phase 2: AI không được làm thay đổi game nếu chưa qua tay anh.
* Công thức thay thế có thể là **0**: với nhiều vật phẩm, câu trả lời đúng là “không có đường nào khác hợp lý”.
* Chưa kiểm chứng với mô hình thật và Meshy thật (BLOCKED, xem `PHASE2_OWNER_STEPS_VI.md`); các bài test dùng mô hình giả, nhưng cổng kiểm tra là mã thật.
