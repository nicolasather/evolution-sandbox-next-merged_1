# Kiểm tra gói Ancient 1000 trên dữ liệu thật (2026-10-15)

## Số liệu
- Dữ liệu thật: 1917 node (g1-g11). Gói tạo 1000 bản ghi nháp, đánh số 1920-2919, không va chạm số thứ tự.
- build_ancient1000.py chạy với --repo: 0 lỗi va chạm công thức / ID / tên chính xác; thứ tự `ds` hợp lệ.
- Trùng nghĩa với mục đã có (độ giống >= 0.8): 26 mục (xem anc27_review_report.json) - phải loại hoặc thay bằng ứng viên dự trữ.
- Nguồn theo từng mục đã xác minh: 0/1000. Admin duyệt: 0/1000.

## Vấn đề chất lượng công thức (kiểm tra tay trên mẫu)
Bộ lọc tự động chỉ bắt được 4 lỗi, nhưng đọc mẫu cho thấy công thức do gói sinh ra thường KHÔNG có cơ chế thật:
- Domesticated Chickpea <- Domesticated Common Bean + seed_selection (đậu thường là cây Tân Thế giới; thuần hóa không phải phép ghép)
- Brahmi Rock Inscription <- Latin Inscribed Tablet + writing (chữ Latin xuất hiện sau Brahmi, và chữ viết không sinh ra từ chữ khác theo kiểu ghép)
- Egyptian Hieroglyphic Inscription <- Brahmi Rock Inscription + pottery
- Bronze Surgical Probe <- medicine + iron (đồng thanh làm từ sắt)
- Ear Examination Probe <- Bronze Surgical Probe + wood
- Shuttle Weft Tool <- Flax Breaking Tool + agriculture
- Sun Dried Tomato Mat (cà chua là cây Tân Thế giới, không thuộc thế giới cổ đại)
Ngoài ra ~29% công thức (288/1000) không có liên hệ từ vựng nào giữa món và nguyên liệu.

## Kết luận
KHÔNG đưa vào g12.json. Chỉ đưa tập con thỏa đủ: (1) nguồn riêng cho từng mục, (2) công thức viết tay có cơ chế hoặc là mục học tập không chế tạo, (3) không trùng 26 mục trên, (4) qua validate/test.
