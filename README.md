# HostingAdvisor — AI tư vấn chọn gói Hosting / Domain (Vibe-Coding 2026 - Đề số 1)

Ứng dụng web tư vấn tự động gói Hosting và Tên miền phù hợp nhất với quy mô, lưu lượng truy cập và ngân sách dành cho chủ shop online nhỏ không rành kỹ thuật.

---

## 1. Tóm tắt đề bài (Đề số 1)

| # | Chức năng | Mô tả |
|---|---|---|
| 1 | **Form nhập nhu cầu** | Loại website (Bán hàng / Giới thiệu / Blog), lượng truy cập ước tính mỗi tháng, ngân sách mỗi tháng, có cần mua kèm tên miền không |
| 2 | **AI tư vấn** | Gợi ý 01 gói phù hợp nhất + 02 gói thay thế, giải thích bằng tiếng Việt đơn giản, dễ hiểu với người không rành kỹ thuật |
| 3 | **Bảng so sánh 3 gói** | So sánh trực quan giá, dung lượng, băng thông, tính năng nổi bật |
| 4 | **Nút "Đăng ký tư vấn"** | Mở form nhập tên + số điện thoại, kiểm tra hợp lệ và lưu vào danh sách khách hàng (`localStorage`) |
| 5 | **FAQ Accordion** | 05 câu hỏi thường gặp về hosting & domain |

---

## 2. Công nghệ sử dụng

- **Frontend:** HTML5, Tailwind CSS (CDN), JavaScript (Vanilla ES6+)
- **Tích hợp AI:** Hybrid Rule-based Scoring + Google Gemini API (`gemini-2.5-flash`) kèm cơ chế Fallback tự động khi mất mạng hoặc hết hạn mức API.
- **Lưu trữ dữ liệu:** `localStorage` (bắt buộc theo đề) + hỗ trợ đồng bộ Supabase.

---

## 3. Cấu trúc thư mục

```text
├── index.html          # Giao diện chính (5 sections: Hero+Form, Kết quả, Bảng so sánh, FAQ, Footer)
├── style.css           # CSS tùy chỉnh
├── plans.js            # Dữ liệu danh mục 6 gói Hosting/VPS cố định
├── faq.js              # Dữ liệu và hiển thị 5 câu hỏi thường gặp (Accordion)
├── app.js              # Logic chấm điểm, gọi AI, hiển thị bảng so sánh và lưu khách hàng
├── config.example.js   # Mẫu cấu hình API Key (đổi tên thành config.js khi chạy)
└── README.md           # Tài liệu hướng dẫn dự án
```

---

## 4. Hướng dẫn cài đặt và chạy dự án

1. Clone repository về máy:
   ```bash
   git clone https://github.com/thetrac44-a11y/vibecoding.git
   cd vibecoding
   ```
2. Cấu hình API Key (tùy chọn để bật AI Gemini thật):
   - Sao chép file `config.example.js` thành `config.js` và điền `GEMINI_API_KEY`.
   - Nếu không có `config.js`, ứng dụng vẫn hoạt động ổn định 100% nhờ bộ giải thích thông minh dự phòng (Fallback).
3. Mở trực tiếp file `index.html` trên trình duyệt hoặc chạy với tiện ích **Live Server** trong VS Code.
