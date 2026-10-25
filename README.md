# HostingAdvisor — AI tư vấn chọn gói Hosting / Domain (Vibe-Coding 2026 - Đề số 1)

Ứng dụng web tư vấn tự động gói Hosting và Tên miền phù hợp nhất với quy mô, lưu lượng truy cập và ngân sách dành cho chủ shop online nhỏ không rành kỹ thuật.

---

## 1. Thông tin bài dự thi

- **Cuộc thi:** VIBE-CODING 2026
- **Đề bài:** Đề số 1 — AI tư vấn chọn gói Hosting / Domain
- **Bảng dự thi:** Bảng A

---

## 2. Công nghệ sử dụng

- **Frontend:** HTML5, Tailwind CSS (CDN), JavaScript thuần (Vanilla ES6+)
- **Tích hợp AI:** Mô hình Hybrid kết hợp thuật toán chấm điểm Rule-based (`scorePlans`) và **Google Gemini API (`gemini-2.5-flash`)** qua Vercel Serverless Function (`/api/advice`), kèm cơ chế Fallback tự động (`buildFallbackReasons`) khi mất mạng hoặc hết hạn mức API.
- **Lưu trữ dữ liệu:** Lưu đồng thời vào `localStorage` (key `"leads"`) và cơ sở dữ liệu đám mây **Supabase** (`public.leads`) có bật bảo mật Row Level Security (RLS) và xác thực quản trị viên Supabase Auth.

---

## 3. Danh sách 5 tính năng cốt lõi và điểm cộng

1. **Form nhập nhu cầu:** Chọn loại website (Bán hàng / Giới thiệu / Blog), lượng truy cập ước tính mỗi tháng, ngân sách hàng tháng (kèm nút chọn nhanh `50k`/`100k`/`300k`/`500k`), tùy chọn mua kèm tên miền và 02 nút "Dùng thử kịch bản mẫu".
2. **AI phân tích và gợi ý:** Đề xuất 01 gói phù hợp nhất + 02 gói thay thế dựa trên catalog cố định, giải thích lý do bằng tiếng Việt bình dân, dễ hiểu, có ví dụ đời thường và cảnh báo rõ nếu vượt ngân sách.
3. **Bảng so sánh 03 gói:** So sánh trực quan giá/tháng, dung lượng, băng thông, sức chứa truy cập, tặng tên miền và danh sách tính năng nổi bật (làm nổi bật cột gói phù hợp nhất, cuộn ngang mượt trên điện thoại).
4. **Đăng ký tư vấn:** Modal nhập họ tên + số điện thoại (kiểm tra định dạng SĐT Việt Nam `^(0|\+84)\d{9}$`, chống đăng ký trùng), lưu vào `localStorage` và đồng bộ lên Supabase.
5. **FAQ Accordion:** 05 câu hỏi thường gặp về Hosting & Domain, đóng/mở mượt mà, hỗ trợ điều hướng bàn phím (`aria-expanded`).
6. **Khu vực quản trị (`#admin`):** Đăng nhập bằng Supabase Auth, xem danh sách khách hàng mới nhất, xóa từng dòng và xuất báo cáo CSV.

---

## 4. Cấu trúc thư mục

```text
├── api/
│   └── advice.js         # Serverless Proxy trên Vercel gọi Gemini API (giấu kín GEMINI_API_KEY)
├── index.html            # Giao diện chính (Hero+Form, Kết quả, Bảng so sánh, FAQ, Modal, Admin, Footer)
├── style.css             # CSS tùy chỉnh và hiệu ứng chuyển động Accordion
├── plans.js              # Danh mục 6 gói Hosting/VPS cố định (PLANS_DATA)
├── faq.js                # Dữ liệu và logic hiển thị 5 câu hỏi thường gặp (FAQ_DATA)
├── app.js                # Logic chấm điểm, gọi AI, hiển thị kết quả, lưu khách hàng và quản trị
├── config.example.js     # File cấu hình mẫu (sao chép thành config.js khi chạy ở máy cá nhân)
├── supabase-schema.sql   # Lệnh SQL khởi tạo bảng leads và chính sách bảo mật RLS trên Supabase
└── README.md             # Tài liệu hướng dẫn dự án và kịch bản kiểm thử
```

---

## 5. Hướng dẫn cài đặt và chạy dự án

### Cách 1: Chạy trực tiếp trên máy cá nhân (Local)

1. Clone repository về máy:
   ```bash
   git clone https://github.com/thetrac44-a11y/vibecoding.git
   cd vibecoding
   ```
2. Tạo file cấu hình `config.js` từ file mẫu `config.example.js`:
   ```js
   const CONFIG = {
     GEMINI_API_KEY: "AIza...",
     SUPABASE_URL: "https://xxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJ..."
   };
   ```
   *(Lưu ý: Nếu để trống `GEMINI_API_KEY`, ứng dụng vẫn hoạt động đầy đủ 100% ở chế độ Gợi ý tự động Fallback).*
3. Mở file `index.html` bằng trình duyệt hoặc chạy tiện ích **Live Server** trong VS Code.

### Cách 2: Triển khai lên Vercel (Giấu khóa API an toàn)

1. Đẩy mã nguồn lên GitHub (file `config.js` đã được chặn bởi `.gitignore`).
2. Đăng nhập [vercel.com](https://vercel.com), chọn **Add New Project** và kết nối với repository `vibecoding`.
3. Trong mục **Environment Variables** trên Vercel, thêm biến:
   - Tên biến: `GEMINI_API_KEY`
   - Giá trị: Khóa Gemini API của bạn (tạo tại `aistudio.google.com`)
4. Bấm **Deploy**. Khi chạy trên Vercel, frontend sẽ gọi vào `/api/advice` (file `api/advice.js`) để máy chủ Vercel đứng ra gọi Gemini API, giúp khóa API không bao giờ bị lộ ra trình duyệt.

---

## 6. Bảng 6 ca kiểm tra thực tế (Test Cases - Bảng A)

| Mã ca | Phân loại | Đầu vào (Input) | Kết quả thực tế (Actual Output) | Trạng thái |
|---|---|---|---|---|
| **TC01** | Bình thường 1 | Loại: `Bán hàng`, Truy cập: `10.000-50.000`, Ngân sách: `150000`, Tên miền: `Có` | Đề xuất gói chính `Business` (129.000đ/tháng) + 2 gói thay thế `Basic`, `Shop Pro`; hiển thị lý do tiếng Việt dễ hiểu và cập nhật bảng so sánh. | Đạt |
| **TC02** | Bình thường 2 | Loại: `Blog`, Truy cập: `Dưới 1.000`, Ngân sách: `50000`, Tên miền: `Không` | Đề xuất gói chính `Starter` (39.000đ/tháng) + 2 gói thay thế `Basic`, `Business`; hiển thị đúng bảng so sánh 3 gói. | Đạt |
| **TC03** | Không hợp lệ 1 | Bỏ trống Loại website, Lượng truy cập và nhập Ngân sách `-20000` rồi bấm "Tư vấn cho tôi" | Chặn gửi form, hiển thị thông báo lỗi màu đỏ dưới từng trường tương ứng, không gọi API. | Đạt |
| **TC04** | Không hợp lệ 2 | Mở modal Đăng ký tư vấn, nhập Tên `"Nguyễn Văn A"` và SĐT sai định dạng `"12345abc"` | Chặn lưu, hiển thị lỗi đỏ yêu cầu số điện thoại hợp lệ gồm 10 chữ số bắt đầu bằng `0` hoặc `+84`. | Đạt |
| **TC05** | Ca biên 1 (Ngân sách rất thấp) | Loại: `Bán hàng`, Truy cập: `Dưới 1.000`, Ngân sách: `10000` (10.000đ - thấp hơn mọi gói) | Vẫn gợi ý gói rẻ nhất/phù hợp nhất, gắn nhãn cảnh báo `"Vượt ngân sách"` trên thẻ kết quả và nêu rõ cụm từ `"vượt ngân sách"` trong phần giải thích. | Đạt |
| **TC06** | Ca biên 2 (Mất mạng / Lỗi API) | Ngắt kết nối Internet (Offline) hoặc API lỗi rồi bấm "Tư vấn cho tôi" | Hệ thống không bị treo hay sập, tự động chuyển sang lời giải thích dự phòng (`buildFallbackReasons`) và hiện nhãn `"Gợi ý tự động (Đang ngoại tuyến)"`. | Đạt |

---

## 7. Giới hạn hiện tại và Nguồn tham khảo

- **Giới hạn:** Dữ liệu 6 gói cước trong `plans.js` là danh mục tiêu chuẩn phục vụ tư vấn; việc thanh toán và kích hoạt máy chủ thực tế sẽ được chuyên viên thực hiện sau khi khách hàng để lại thông tin đăng ký tư vấn.
- **Nguồn tham khảo:**
  - Tài liệu Google Gemini API: `https://ai.google.dev/gemini-api/docs`
  - Tài liệu Supabase Row Level Security (RLS): `https://supabase.com/docs/guides/database/postgres/row-level-security`
  - Tài liệu Tailwind CSS: `https://tailwindcss.com/docs`
