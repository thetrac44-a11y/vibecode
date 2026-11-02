# HostingAdvisor — Cuộc thi Vibe Coding 2026

> Tài liệu thuyết minh kỹ thuật và hồ sơ bàn giao sản phẩm dự thi theo mẫu chuẩn của Ban Tổ Chức.

## 1. Thông tin chung

| Hạng mục | Nội dung |
|---|---|
| Tên đội thi | `<Điền tên đội thi của bạn>` |
| Bảng thi | Bảng A - Công nghệ |
| Đề bài bốc thăm | Đề số 1 — AI tư vấn chọn gói Hosting/Domain |
| Demo online | Cổng khách hàng: `https://vibecode-alpha-brown.vercel.app` — Cổng quản trị OMS: `https://vibecode-alpha-brown.vercel.app/admin.html` |
| Video demo (<= 02 phút) | `<Điền URL video demo của đội>` |
| Source ZIP | `https://github.com/thetrac44-a11y/vibecode/archive/refs/heads/main.zip` |
| Minh chứng dùng AI | Xem trực tiếp tại Mục 10 trong tài liệu `README.md` này (nằm trong gói ZIP) |
| Bảng kiểm thử | Xem trực tiếp tại Mục 11 trong tài liệu `README.md` này (nằm trong gói ZIP) |

## 2. Tính năng chính

- **Tính năng 1 — Khảo sát nhu cầu đầu vào & Kiểm tra tên miền trực tuyến (DNS + Database)**:
  - Người dùng nhập nhu cầu thực tế: Loại website (`Blog cá nhân`, `Giới thiệu doanh nghiệp`, `Shop bán hàng / TMĐT`, `Web App / SaaS`), lưu lượng truy cập dự kiến (`Dưới 1.000` đến `Trên 50.000 lượt/tháng`), ngân sách chi trả hàng tháng (`39.000đ – 800.000đ+`) và tên miền mong muốn.
  - Công cụ **Kiểm tra tên miền trực tuyến (`GET /api/domains/check`)**: kết hợp tra cứu bản ghi DNS thực tế trên Internet (`dns.lookup`) và đối chiếu toàn bộ đơn hàng đã đăng ký trên cơ sở dữ liệu Cloud SQL (`orders`), hiển thị trạng thái còn trống theo từng đuôi mở rộng (`.com`, `.vn`, `.net`, `.com.vn`, `.shop`), cho phép chủ sở hữu đang đăng nhập dùng lại tên miền của chính mình để gia hạn/nâng cấp, chặn đặt trùng tên miền của người khác và tự động gợi ý các biến thể tên miền còn trống (`-shop.vn`, `-vn.vn`, `-official.vn`).
- **Tính năng 2 — AI phân tích chuyên sâu, Chatbot Chuyên gia AI 24/7 & Trợ lý AI Telesale (`gemini-2.5-flash`)**:
  - Kết hợp thuật toán chấm điểm đa tiêu chí và mô hình **Google Gemini (`gemini-2.5-flash`)** qua Backend Proxy (`POST /api/advice`) để đề xuất **01 gói chính phù hợp nhất** và **02 gói thay thế** trong danh mục 6 gói (`Starter`, `Basic`, `Business`, `Shop Pro`, `VPS Growth`, `VPS Power`), giải thích lý do kỹ thuật, tư vấn chiến lược bảo vệ thương hiệu tên miền, tự động lập bảng so sánh trực quan 3 gói và lưu thông tin vào phễu khách hàng tiềm năng (`Leads`).
  - **Cửa sổ Chatbot Chuyên gia AI 24/7 (`POST /api/chat`)** ở góc dưới bên phải trang chủ: cho phép khách hàng hội thoại hỏi - đáp trực tiếp với AI (hoặc bấm các nút câu hỏi gợi ý nhanh 1-Click) về bảng giá gói cước, so sánh đuôi tên miền `.vn`/`.com`, mã giảm giá và chọn mua gói ngay trong khung chat.
  - Tích hợp **Trợ lý AI Telesale (`POST /api/advice/sales-script`)** tại cổng quản trị OMS, giúp nhân viên tự động soạn kịch bản gọi điện tư vấn 3 bước cá nhân hóa theo từng đơn hàng hoặc từng yêu cầu tư vấn (`Lead`).
- **Tính năng 3 — Đặt mua Thương mại điện tử, Thanh toán VietQR động, Hóa đơn điện tử & Quản trị Hosting (`cPanel`)**:
  - Tùy chỉnh chu kỳ thanh toán (`12 tháng` nguyên giá, `24 tháng` giảm 10%, `36 tháng` giảm 20%), tự động khấu trừ 100% phí tên miền năm đầu cho các gói có ưu đãi (`Basic`, `Business`, `Shop Pro`), chọn dịch vụ mua kèm (`Add-ons`: Whois Privacy, Daily Backup, Dedicated IP) và áp dụng mã giảm giá (`VIBE2026` giảm 15%, `CHUSHOP` giảm 50.000đ).
  - Tự động sinh mã QR chuyển khoản ngân hàng chuẩn **VietQR** (`img.vietqr.io`) khớp chính xác số tiền và nội dung chuyển khoản (`ORD-2026-XXXXX`), xuất **Hóa đơn điện tử (`INV-2026-XXXXX`)** có con dấu trạng thái `ĐÃ THANH TOÁN (PAID)` / `CHỜ THANH TOÁN (UNPAID)` và hỗ trợ in ấn / lưu PDF (`@media print`).
  - Quản lý **"Đơn Hàng Của Tôi"** cô lập bảo mật theo `userId` của tài khoản đăng nhập (hoặc tra cứu theo Số điện thoại): hỗ trợ lấy lại mã QR để thanh toán tiếp đơn chờ, chủ động hủy đơn nháp khi chưa kích hoạt, **Gia hạn nhanh 1-Click** và **Nâng cấp gói Hosting 1-Click**.
  - Bảng điều khiển kỹ thuật **"Quản Lý Hosting (cPanel)"** cho các đơn hàng đã kích hoạt: hiển thị trạng thái máy chủ vật lý (`Uptime 99.98%`), ngày kích hoạt/hết hạn chính xác theo chu kỳ, đường dẫn `cPanel`, tài khoản/mật khẩu kỹ thuật (có nút sao chép nhanh), địa chỉ IP Server (`A Record`), cặp Nameservers, thanh giám sát tài nguyên (SSD/NVMe, Băng thông, Chịu tải) và **4 công cụ vận hành 1-Click** (`Cài đặt WordPress/WooCommerce`, `Kiểm tra & Đồng bộ DNS`, `Cấp chứng chỉ AutoSSL HTTPS`, `Tạo bản sao lưu Full Backup .tar.gz`).
  - Hỗ trợ khách hàng cập nhật **Hồ sơ cá nhân & Đổi mật khẩu** (`PATCH /api/auth/profile`) và gửi **Đánh giá dịch vụ** có nhãn xác thực đơn hàng (`Verified Buyer`) kèm phân trang 3 đánh giá/trang.
- **Tính năng 4 — Nghiệp vụ Nhân viên Kinh doanh & Kỹ thuật (`Staff` trên Cổng OMS `/admin.html`)**:
  - **Bảng Thống kê Hiệu suất & Hoa hồng cá nhân (`#staff-personal-kpi-bar`)**: tính toán thời gian thực số đơn phụ trách (`Đã kích hoạt / Tổng nhận`), doanh thu cá nhân, **hoa hồng dự kiến (5% doanh số kích hoạt)** và tỷ lệ chuyển đổi Lead, kèm nút lọc nhanh **"Chỉ Xem Đơn Của Tôi"**.
  - **Quản lý Đơn hàng Đa chiều, Phân trang & Tự nhận việc**: lọc kết hợp từ khóa, trạng thái, người phụ trách (`Tất cả`, `Đơn của tôi phụ trách`, `Chưa phân công`), sắp xếp (`Mới nhất lên đầu`, `Cũ nhất lên đầu`, `Ưu tiên đơn chờ duyệt`), phân trang `6 đơn/trang` hoặc `Xem tất cả`; hỗ trợ nút **Nhận đơn (`claim`)** 1-Click và tự động gán `assignedTo` khi nhân viên xử lý đơn chưa có người phụ trách.
  - **Công cụ Bán hàng tại chỗ (`+ Tạo Đơn Hộ Khách` - POS)**: tạo đơn nhanh cho khách qua điện thoại, tích hợp nút **Kiểm tra tên miền trực tiếp** ngay trong cửa sổ tạo đơn.
  - **Bộ công cụ CSKH & Kỹ thuật 1-Click trong chi tiết đơn**: Duyệt tiền VietQR & cấp phát tự động IP/cPanel, `Copy Tin Nhắn Nhắc Thanh Toán`, `Copy Bản Tin Bàn Giao Hosting`, `Cấp Lại Mật Khẩu cPanel Mới` và `Tạo Đơn Gia Hạn 12 Tháng (1-Click)`.
  - **Quản lý Khách hàng tiềm năng CRM (`Leads`)**: nhận chăm sóc khách từ phễu khảo sát AI, bấm gọi điện trực tiếp, cập nhật trạng thái (`Mới`, `Đã liên hệ`, `Đã chốt đơn`, `Không tiếp cận`), dùng AI soạn kịch bản tư vấn và **Chuyển đổi Lead thành Đơn hàng chính thức 1-Click (`POST /api/leads/:id/convert-to-order`)**.
- **Tính năng 5 — Quản trị Hệ thống, Phân tích Doanh thu, Nhân sự & Bảng giá động (`Admin` trên Cổng OMS `/admin.html`)**:
  - **Báo cáo Phân tích Cơ cấu Doanh thu (`Revenue Breakdown Analytics`)**: biểu đồ thanh tiến độ trực quan thống kê doanh thu và số đơn theo từng gói Hosting, theo chu kỳ thanh toán (`12/24/36 tháng`) và tỷ trọng nguồn thu (`Web Hosting cốt lõi`, `Tên miền`, `Add-ons`), kèm xuất báo cáo tài chính `CSV` chuẩn UTF-8 BOM.
  - **Bảng xếp hạng KPI Nhân sự & Quản lý tài khoản Staff**: xếp hạng toàn bộ nhân sự từ cao xuống thấp theo doanh thu mang về, số đơn hoàn tất, hoa hồng 5% và tỷ lệ chốt Lead; hỗ trợ Admin tạo tài khoản Staff mới, **Đổi mật khẩu (`PATCH /api/admin/users/:id/password`)** hoặc **Xóa/Thu hồi tài khoản (`DELETE /api/admin/users/:id`)** có hộp thoại xác nhận an toàn.
  - **Danh bạ Khách hàng Thành viên & Chi tiêu Tích lũy (`Customer Directory & LTV`)**: thống kê toàn bộ tài khoản khách hàng (`role: 'customer'`) xếp hạng theo tổng giá trị chi tiêu tích lũy (`Lifetime Value - LTV`) và số đơn đã kích hoạt, cho phép Admin cấp lại mật khẩu hoặc xóa tài khoản rác.
  - **Điều chỉnh Bảng giá & Cấu hình thời gian thực trên Cloud SQL**: chỉnh sửa trực tiếp đơn giá tháng và ưu đãi tặng tên miền của từng gói Hosting (`PATCH /api/admin/plans/:id`), giá đăng ký năm của từng đuôi tên miền (`PATCH /api/admin/domains`), giá từng dịch vụ bổ trợ (`PATCH /api/admin/addons/:id`), thêm/xóa mã giảm giá (`Coupons`), đổi cấu hình tài khoản ngân hàng nhận tiền VietQR (`PUT /api/admin/settings`) và kiểm duyệt đánh giá khách hàng.

## 3. Công nghệ sử dụng

| Lớp | Công nghệ (ghi đúng thứ đã dùng) |
|---|---|
| Giao diện | HTML5 / CSS3 / JavaScript (ES6+ thuần) + Tailwind CSS (CDN v3.4) |
| Thư viện & Dịch vụ tích hợp | `@supabase/supabase-js` (`^2.118.0`), `express` (`^4.21.1`), `jsonwebtoken` (`^9.0.2`), `dotenv` (`^16.4.5`), `cors` (`^2.8.5`), module `crypto` & `dns.promises` (Node.js built-in), VietQR Image API, Google Fonts (`Inter`) |
| Lưu trữ | Backend Node.js/Express kết nối Cloud SQL **Supabase PostgreSQL** (9 bảng dữ liệu trên đám mây, kèm cơ chế Auto-Seed và tự động fallback về `db.json` cục bộ + `localStorage` phía trình duyệt) |
| Triển khai | Vercel (Full-stack Serverless Node.js qua `api/index.js` & `vercel.json`) |

## 4. Tích hợp AI

- **Chế độ đang dùng**: **API thật** (kèm cơ chế Fallback thông minh khi vượt hạn mức hoặc mất kết nối mạng)
  - API thật: **Google Gemini (`gemini-2.5-flash`)** gọi từ Backend qua REST endpoint `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`.
  - Cơ chế dự phòng (Fallback): Nếu môi trường chạy chưa khai báo `GEMINI_API_KEY` hoặc kết nối API bên ngoài gián đoạn, máy chủ tự động chuyển sang bộ máy chấm điểm và sinh văn bản tư vấn theo quy tắc (Rule-based Engine) để đảm bảo ứng dụng luôn phản hồi 100% không bị lỗi.
- **Mục đích**:
  1. Phân tích nhu cầu loại website, lưu lượng, ngân sách và tên miền của khách hàng tại cổng mua sắm (`POST /api/advice`) để đưa ra lời khuyên chọn gói Hosting và chiến lược tên miền.
  2. Hội thoại hỏi - đáp trực tuyến 24/7 với khách hàng qua cửa sổ Chatbot AI (`POST /api/chat`) dựa trên dữ liệu bảng giá gói cước, tên miền và mã giảm giá thực tế đang có trên Supabase.
  3. Phân tích dữ liệu đơn hàng và yêu cầu tư vấn tại cổng quản trị (`POST /api/advice/sales-script`) để soạn kịch bản gọi điện Telesale 3 bước cho nhân viên kinh doanh.
- **Bảo mật khoá API**: Không đặt khóa API trong mã nguồn phía client (`public/`). Khóa được lưu trong biến môi trường `.env` (nằm trong `.gitignore`, không commit lên Git) và chỉ được gọi qua Backend proxy trong `server.js`.

Biến môi trường cấu hình trong file `.env` (tham khảo `.env.example`):

```env
PORT=3000
JWT_SECRET=<chuỗi_bí_mật_ký_jwt>
GEMINI_API_KEY=<khóa_api_google_gemini_của_bạn>
SUPABASE_URL=<đường_dẫn_project_supabase>
SUPABASE_KEY=<khóa_kết_nối_supabase>
```

## 5. Cài đặt và chạy local

Yêu cầu: Trình duyệt hiện đại; **Node.js >= 18**.

**Chạy ứng dụng Full-stack (Node.js + Express + Supabase PostgreSQL / Local JSON)**

1. Giải nén file ZIP (hoặc clone kho mã nguồn) và mở Terminal tại thư mục gốc của dự án.
2. Cài đặt các gói thư viện:

```bash
npm install
```

3. Tạo file cấu hình môi trường `.env` từ file mẫu `.env.example` (nếu để trống `SUPABASE_URL` và `SUPABASE_KEY`, ứng dụng sẽ tự động chạy bằng cơ sở dữ liệu cục bộ `db.json` đã có sẵn đầy đủ 6 gói cước, bảng giá tên miền, dịch vụ bổ trợ, mã giảm giá và 3 tài khoản demo):

```bash
cp .env.example .env
```

4. Khởi chạy máy chủ:

```bash
npm start
```

5. Mở trình duyệt truy cập:
   - Cổng mua sắm dành cho Khách hàng (`User`): `http://localhost:3000/index.html`
   - Cổng quản trị OMS dành cho Quản trị viên & Nhân viên (`Admin` / `Staff`): `http://localhost:3000/admin.html`

## 6. Cấu trúc thư mục

```text
videcode/
├── api/
│   └── index.js                # Entrypoint Serverless Function cho Vercel
├── public/                     # Tài nguyên giao diện phía Client (Frontend)
│   ├── index.html              # Cổng mua sắm, AI tư vấn, tra cứu đơn & quản trị cPanel cho Khách hàng
│   ├── admin.html              # Cổng quản trị đơn hàng (OMS), Leads, Nhân sự & Cấu hình cho Admin/Staff
│   ├── css/
│   │   └── style.css           # Định dạng giao diện, thanh cuộn bảng và chế độ in hóa đơn (@media print)
│   └── js/
│       ├── config.js           # Cấu hình mặc định phía Client
│       ├── plans.js            # Dữ liệu danh mục 6 gói Hosting/VPS mặc định
│       ├── domains.js          # Bảng giá đuôi tên miền mặc định
│       ├── addons.js           # Danh mục dịch vụ cộng thêm (Add-ons) mặc định
│       ├── faq.js              # Dữ liệu câu hỏi thường gặp (FAQ Accordion)
│       ├── app.js              # Logic trang Khách hàng: AI tư vấn, kiểm tra DNS, giỏ hàng VietQR, cPanel
│       └── admin.js            # Logic trang Quản trị: RBAC, POS, duyệt đơn, Leads CRM, KPI & cấu hình giá
├── server.js                   # Máy chủ Backend Express: 31 RESTful APIs, JWT Auth, DNS check, Gemini Proxy
├── db.js                       # Tầng truy xuất dữ liệu đồng nhất: Supabase PostgreSQL + Auto-Seed + Fallback db.json
├── db.json                     # Cơ sở dữ liệu JSON cục bộ phục vụ khởi tạo mẫu (Seed) và chạy Offline
├── supabase_schema.sql         # Kịch bản SQL khởi tạo 9 bảng dữ liệu trên Supabase PostgreSQL
├── vercel.json                 # Cấu hình định tuyến triển khai trên Vercel
├── .env.example                # Mẫu cấu hình biến môi trường (không chứa khóa thật)
├── package.json                # Khai báo thông tin dự án và các thư viện Node.js
└── README.md                   # Tài liệu thuyết minh, minh chứng AI và bảng kiểm thử theo mẫu BTC
```

## 7. Truy cập và phân quyền

Hệ thống áp dụng cơ chế xác thực **JWT (JSON Web Token)** kết hợp băm mật khẩu một chiều (**Salted SHA-256**) và phân quyền **RBAC (Role-Based Access Control)** 3 cấp độ:

- **Khách hàng (`customer` hoặc khách vãng lai tại `/index.html`)**:
  - Khách vãng lai có thể sử dụng AI tư vấn gói cước, kiểm tra tên miền, đặt mua dịch vụ, quét mã VietQR và tra cứu đơn hàng bằng Số điện thoại mà không bắt buộc đăng nhập.
  - Khi đăng ký/đăng nhập tài khoản khách hàng: Hệ thống cô lập dữ liệu nghiêm ngặt theo `userId`, cho phép quản lý danh sách đơn hàng cá nhân, thanh toán tiếp hoặc hủy đơn chờ, gia hạn/nâng cấp gói 1-Click, mở bảng điều khiển kỹ thuật `cPanel`, cập nhật hồ sơ/đổi mật khẩu và gửi đánh giá dịch vụ có xác thực (`Verified Buyer`). Khách hàng hoàn toàn không nhìn thấy liên kết Cổng Quản Trị.
- **Nhân viên (`staff` tại `/admin.html`)**:
  - Xem, lọc, sắp xếp, tự nhận phụ trách (`Nhận đơn`) và duyệt kích hoạt đơn hàng; tạo đơn hộ khách (`+ Tạo Đơn Hộ Khách`), tạo đơn gia hạn 1-Click; sử dụng bộ công cụ CSKH/Kỹ thuật (`Copy nhắc thanh toán`, `Copy bàn giao Hosting`, `Cấp lại mật khẩu cPanel`); quản lý và chuyển đổi khách hàng tiềm năng (`Leads`) thành đơn hàng; sử dụng AI Telesale và theo dõi bảng KPI doanh thu cùng hoa hồng 5% cá nhân.
  - Bị giới hạn quyền: Không được xóa đơn hàng, không được xóa Lead và không nhìn thấy tab **Quản Trị Hệ Thống & Nhân Sự (Admin)**.
- **Quản trị viên (`admin` tại `/admin.html`)**:
  - Toàn quyền thực hiện mọi nghiệp vụ của `Staff`, đồng thời mở khóa tab **Quản Trị Hệ Thống & Nhân Sự (Admin)** để xem báo cáo phân tích cơ cấu doanh thu, bảng xếp hạng KPI nhân sự, danh bạ khách hàng (`LTV`), tạo/đổi mật khẩu/xóa tài khoản nhân viên và khách hàng, điều chỉnh trực tiếp bảng giá gói Hosting/Tên miền/Add-ons, quản lý mã giảm giá (`Coupons`), cấu hình ngân hàng VietQR và kiểm duyệt đánh giá.

## 8. Giới hạn hiện tại

- **Đối soát thanh toán ngân hàng**: Mã QR chuyển khoản được sinh động theo chuẩn VietQR thực tế (`img.vietqr.io`) với đúng số tiền và nội dung mã đơn; bước xác nhận tiền về hiện thực hiện bán tự động (Khách bấm xác nhận đã chuyển khoản -> Staff/Admin kiểm tra và bấm duyệt kích hoạt trên OMS) thay vì dùng cổng Webhook ngân hàng thương mại trả phí.
- **Bảng điều khiển kỹ thuật Hosting (`cPanel`)**: Các tác vụ quản trị máy chủ sau mua (cấp phát IP, cài đặt WordPress 1-Click, đồng bộ DNS, cấp chứng chỉ AutoSSL, nén bản sao lưu `.tar.gz`) được mô phỏng trực quan trên ứng dụng nhằm thể hiện trọn vẹn quy trình cung cấp dịch vụ lưu trữ web, chưa đấu nối trực tiếp tới máy chủ WHM/cPanel vật lý.

## 9. Nguồn tham khảo

- Thể lệ và tiêu chí chấm giải Cuộc thi **Vibe Coding 2026** (`https://vibecoding.info.vn/tieu-chi-cham-thi`).
- Tài liệu API chính thức của Google Gemini (`https://ai.google.dev/gemini-api/docs`).
- Tài liệu SDK của Supabase PostgreSQL (`https://supabase.com/docs`) và chuẩn tạo mã thanh toán VietQR (`https://www.vietqr.io`).
- Bộ phông chữ mã nguồn mở Google Fonts (`Inter`).

## 10. Minh chứng dùng AI để xây dựng sản phẩm

Dưới đây là 03 vòng tương tác thực tế tiêu biểu trong quá trình sử dụng AI để phát triển, kiểm thử phát hiện lỗi và hoàn thiện sản phẩm **HostingAdvisor v3.3**:

### Vòng 1: Xây dựng công cụ kiểm tra tên miền thực tế kết hợp AI tư vấn gói cước
- **Mục tiêu**: Giúp người dùng vừa nhận được gợi ý gói Hosting từ Gemini AI vừa kiểm tra chính xác tên miền dự kiến có còn trống để đăng ký hay không.
- **Yêu cầu cho AI**: *"Viết API `/api/advice` kết nối Gemini `gemini-2.5-flash` để gợi ý 1 gói chính + 2 gói phụ kèm bảng so sánh; đồng thời viết API `/api/domains/check` kiểm tra trạng thái tên miền và tính phí tự động trong giỏ hàng."*
- **Vấn đề phát hiện khi thử**: Bản đầu tiên chỉ kiểm tra định dạng chữ cái của tên miền nên khi nhập các tên miền đã tồn tại trên Internet hoặc tên miền đã được khách hàng khác đặt mua trong hệ thống, ứng dụng vẫn báo "Còn trống" và cho phép đặt trùng.
- **Yêu cầu sửa**: *"Nâng cấp `/api/domains/check` và `/api/orders` trong `server.js`: sử dụng `dns.promises.lookup` để kiểm tra bản ghi DNS thực tế trên Internet kết hợp quét danh sách đơn hàng trên Supabase; nếu tên miền đã có chủ sở hữu khác thì chặn đặt mới và tự động gợi ý 3 biến thể tên miền còn trống (`-shop.vn`, `-vn.vn`, `-official.vn`), nhưng vẫn cho phép chính chủ sở hữu đó dùng lại tên miền khi bấm Gia hạn hoặc Nâng cấp gói."*
- **Kết quả kiểm tra lại**: Khi tra cứu tên miền đã có chủ hoặc đã được mua ở đơn trước, hệ thống báo chính xác lý do không khả dụng kèm danh sách tên miền gợi ý còn trống; đồng thời luồng Gia hạn / Nâng cấp của khách hàng cũ hoạt động mượt mà không bị chặn nhầm.

### Vòng 2: Khắc phục lỗi rò rỉ phiên đăng nhập và ngày hết hạn dịch vụ (`Invalid Date`) ở phân hệ Khách hàng
- **Mục tiêu**: Đảm bảo mỗi khách hàng đăng nhập chỉ nhìn thấy đơn hàng của riêng mình và xem đúng thông số kỹ thuật trong bảng điều khiển `cPanel`.
- **Yêu cầu cho AI**: *"Kiểm tra toàn bộ luồng Đăng nhập, mục 'Đơn Hàng Của Tôi' và cửa sổ 'Quản Lý Hosting (cPanel)' trên `index.html`."*
- **Vấn đề phát hiện khi thử**: Phát hiện 2 lỗi thực tế: (1) Khi tài khoản A đăng xuất và tài khoản B đăng nhập trên cùng trình duyệt, mục "Đơn Hàng Của Tôi" vẫn hiển thị đơn của tài khoản A do biến `ha_last_buyer` trong `localStorage` chưa được xóa và Backend còn lọc ghép theo SĐT cũ; (2) Một số đơn hàng đã duyệt trước đó chưa có trường `expireDate` trong `serviceDetails` khiến giao diện hiển thị chữ `Invalid Date`.
- **Yêu cầu sửa**: *"Sửa `GET /api/orders/my-orders` chỉ lọc nghiêm ngặt theo `o.userId === tokenUser.id` khi người dùng đã đăng nhập; xóa sạch dữ liệu người mua tạm khi chuyển đổi phiên đăng nhập; bổ sung công thức tự động tính ngày hết hạn dự phòng từ `activatedAt + billingCycleMonths * 30 ngày` khi duyệt đơn và khi hiển thị `cPanel`."*
- **Kết quả kiểm tra lại**: Các tài khoản khách hàng được cô lập dữ liệu tuyệt đối 100%; toàn bộ đơn hàng đã kích hoạt đều hiển thị chính xác ngày kích hoạt và ngày hết hạn định dạng `dd/mm/yyyy`.

### Vòng 3: Mở rộng nghiệp vụ Staff/Admin thực tế và sửa lỗi tràn giao diện trên điện thoại di động
- **Mục tiêu**: Hoàn thiện đầy đủ công cụ làm việc cho Nhân viên (`Staff`) và Quản trị viên (`Admin`) trên `admin.html`, đảm bảo hiển thị tốt trên cả máy tính và điện thoại.
- **Yêu cầu cho AI**: *"Bổ sung cho Staff thanh KPI hoa hồng 5%, nút Nhận đơn, tạo đơn hộ khách POS, tạo đơn gia hạn 1-Click, copy tin nhắn bàn giao Hosting; bổ sung cho Admin tab riêng gồm Báo cáo phân tích cơ cấu doanh thu, Bảng xếp hạng nhân sự, Danh bạ khách hàng LTV và công cụ chỉnh sửa trực tiếp giá gói Hosting / Tên miền / Add-ons trên Supabase."*
- **Vấn đề phát hiện khi thử**: Khi kiểm tra thực tế trên trình duyệt, phát hiện 3 vấn đề: (1) Admin đổi mật khẩu nhân viên báo thành công nhưng không đăng nhập được bằng mật khẩu mới do cột mật khẩu trên bảng `users` của Supabase tên là `password_hash` chứ không phải `password`; (2) Khi có nhiều đơn mới phát sinh, các đơn cũ bị đẩy sâu xuống dưới không có phân trang; (3) Trên màn hình điện thoại di động, thanh người dùng (`#admin-user-bar`) trên Header không tự xuống dòng làm tràn ngang màn hình.
- **Yêu cầu sửa**: *"Cập nhật hàm `updateUser` trong `db.js` ghi đúng cột `password_hash`; bổ sung bộ chọn sắp xếp và thanh phân trang (`6 đơn/trang` + nút `Xem tất cả`) cho bảng đơn hàng; thêm `flex-wrap`, `min-w-0` và `overflow-x: hidden` cho thanh Header cùng khung bảng trên `admin.html`."*
- **Kết quả kiểm tra lại**: Tính năng đổi mật khẩu hoạt động chính xác ngay trên Supabase; bảng đơn hàng phân trang rõ ràng; giao diện điện thoại vừa khít 100% khung nhìn ngang.

## 11. Bảng kiểm thử

Bảng kiểm thử gồm **08 ca kiểm thử thực tế** (3 ca bình thường, 3 ca đầu vào không hợp lệ, 2 ca biên/sự cố), đáp ứng đầy đủ yêu cầu của **Bảng A**:

| Mã ca | Loại ca | Dữ liệu và bước thử | Kỳ vọng | Kết quả thực tế | Đạt/Chưa đạt |
|---|---|---|---|---|---|
| **TC01** | Bình thường | **Khảo sát AI tư vấn chọn gói & Lưu Lead**: Tại `index.html`, chọn loại web `Shop bán hàng / TMĐT`, lưu lượng `10.000 - 30.000 lượt/tháng`, ngân sách `150.000`, tên miền `yenboutique` + `.vn`, bấm **Nhận Tư Vấn Từ AI**. | Hệ thống gọi `/api/advice`, hiển thị nhận định từ Gemini AI, đề xuất 01 gói chính (`Business`) kèm 02 gói thay thế (`Shop Pro`, `Basic`), vẽ bảng so sánh 3 gói và tự động lưu yêu cầu vào danh sách `Leads`. | Hiển thị đầy đủ lời khuyên AI cá nhân hóa, 3 gói đề xuất, bảng so sánh thông số và ghi nhận Lead thành công trên OMS. | **Đạt** |
| **TC02** | Bình thường | **Đặt hàng, áp Coupon, VietQR & Hóa đơn**: Chọn mua gói `Business`, chu kỳ `24 tháng` (giảm 10%), tích thêm `Daily Backup`, nhập mã `VIBE2026` (giảm 15%), điền Họ tên `Nguyễn Hoàng Yến`, SĐT `0912345678`, bấm **Xác Nhận Đặt Đơn** rồi bấm **Tôi Đã Chuyển Khoản**. | Hệ thống miễn phí tên miền `.vn` năm đầu, tính đúng chiết khấu chu kỳ + mã giảm giá, sinh mã VietQR đúng số tiền, chuyển trạng thái đơn sang `Chờ duyệt tiền (Đã CK)` và mở được Hóa đơn điện tử `INV-2026-XXXXX`. | Đơn hàng được lưu lên Supabase, mã VietQR khớp chính xác tổng tiền và mã đơn, in được Hóa đơn điện tử. | **Đạt** |
| **TC03** | Bình thường | **Staff/Admin duyệt đơn, cấp cPanel & điều chỉnh bảng giá**: Đăng nhập `admin.html`, mở đơn vừa đặt, bấm **Xác Nhận Đã Nhận Tiền & Kích Hoạt Dịch Vụ**. Sau đó sang tab Admin sửa thử giá gói/tên miền, và quay lại `index.html` mở **Quản Lý Hosting (cPanel)**. | Đơn chuyển sang `Đã kích hoạt (Paid)`, tự động cộng doanh thu + hoa hồng 5% cho nhân sự phụ trách, sinh IP/DNS/tài khoản `cPanel` và ngày hết hạn. Khách hàng mở được bảng điều khiển `cPanel` trên trang chủ. | Toàn bộ chỉ số KPI, bảng xếp hạng nhân sự, phân tích doanh thu và bảng điều khiển `cPanel` cập nhật chính xác theo thời gian thực. | **Đạt** |
| **TC04** | Đầu vào không hợp lệ | **Bỏ trống thông tin hoặc nhập sai định dạng SĐT**: Mở cửa sổ Thanh toán, Tạo đơn hộ khách (POS) hoặc Hồ sơ cá nhân, để trống Họ tên hoặc nhập SĐT không đủ 10 chữ số (`091234` hoặc `abc1234567`) rồi bấm Lưu/Đặt đơn. | Hệ thống chặn gửi dữ liệu, hiển thị thông báo lỗi yêu cầu nhập đầy đủ Họ tên và Số điện thoại hợp lệ (10 chữ số bắt đầu bằng số `0`). | Hiển thị cảnh báo lỗi rõ ràng ngay tại biểu mẫu, không phát sinh đơn hàng hoặc bản ghi lỗi lên cơ sở dữ liệu. | **Đạt** |
| **TC05** | Đầu vào không hợp lệ | **Nhập mã giảm giá sai & đăng ký trùng tên miền**: Nhập mã giảm giá `MA_KHONG_TON_TAI` tại giỏ hàng; hoặc nhập tên miền đã có người đăng ký ở đơn hàng khác. | Với mã giảm giá sai: báo lỗi mã không hợp lệ và giữ nguyên tổng tiền. Với tên miền trùng: chặn đặt mới, báo rõ nguyên nhân và tự động gợi ý các biến thể tên miền còn trống. | Báo lỗi chính xác trong cả 2 trường hợp; công cụ kiểm tra tên miền hiển thị ngay 3 gợi ý tên miền thay thế khả dụng. | **Đạt** |
| **TC06** | Đầu vào không hợp lệ | **Kiểm tra phân quyền bảo mật RBAC & Cô lập tài khoản**: (1) Dùng tài khoản Khách hàng (`hoangyen`) đăng nhập vào `admin.html`; (2) Dùng tài khoản `staff` gọi API xóa đơn hoặc sửa giá của `admin`; (3) Đăng nhập 2 tài khoản khách hàng khác nhau để kiểm tra mục "Đơn Hàng Của Tôi". | (1) Chặn Khách hàng vào OMS; (2) Chặn `staff` truy cập API quản trị hệ thống (`403 Forbidden`); (3) Mỗi tài khoản khách hàng chỉ nhìn thấy đúng đơn hàng thuộc `userId` của mình. | Phân quyền RBAC và cô lập dữ liệu tài khoản hoạt động chính xác tuyệt đối ở cả Giao diện và Backend API. | **Đạt** |
| **TC07** | Ca biên / Sự cố | **Mất kết nối Gemini AI hoặc vượt hạn mức API (Rate Limit / Offline)**: Thử thực hiện khảo sát tư vấn gói cước và bấm nút "AI Soạn Kịch Bản Gọi Điện" khi khóa `GEMINI_API_KEY` bị ngắt hoặc dịch vụ AI phản hồi lỗi. | Hệ thống không bị văng lỗi `500` hay treo giao diện, tự động chuyển sang bộ máy tư vấn dự phòng (Rule-based Fallback) để trả về nhận định gói cước và kịch bản Telesale 3 bước. | Cả cổng Khách hàng và cổng Quản trị đều trả về kết quả tư vấn hợp lệ trong dưới 1 giây, trải nghiệm liền mạch không gián đoạn. | **Đạt** |
| **TC08** | Ca biên / Sự cố | **Chạy ứng dụng Offline khi chưa cấu hình Cloud SQL (`.env` trống)**: Giải nén gói Source ZIP trên máy mới và chạy `npm start` ngay mà không cấu hình `SUPABASE_URL` và `SUPABASE_KEY`. | Tầng truy xuất `db.js` tự động phát hiện và chuyển sang chế độ đọc/ghi trên cơ sở dữ liệu cục bộ `db.json` mà không làm sập máy chủ `server.js`. | Máy chủ khởi động thành công tại `http://localhost:3000`, có sẵn 6 gói cước, bảng giá tên miền, mã giảm giá và 3 tài khoản demo (`admin`, `staff`, `hoangyen`) hoạt động đầy đủ. | **Đạt** |

## 12. Hồ sơ bàn giao

- **Source ZIP**: Chứa toàn bộ mã nguồn Full-stack, kịch bản `supabase_schema.sql`, dữ liệu khởi tạo `db.json`, cấu hình mẫu `.env.example` và tài liệu `README.md` này (không chứa khóa API thật trong mã nguồn).
- **Tài khoản & Dữ liệu Demo (hoạt động trên cả bản Demo Online Vercel và bản chạy Local ZIP)**:
  - **Cổng Mua Sắm Khách Hàng (`/index.html`)**:
    - Tài khoản Khách hàng mẫu: Tên đăng nhập `hoangyen` — Mật khẩu `123456@password` (hoặc tự đăng ký tài khoản mới / đặt mua trực tiếp không cần đăng nhập).
    - Mã giảm giá thử nghiệm: `VIBE2026` (Giảm 15% tổng hóa đơn), `CHUSHOP` (Giảm trực tiếp 50.000đ).
  - **Cổng Quản Trị Đơn Hàng & Doanh Thu OMS (`/admin.html`)**:
    - Tài khoản Quản trị viên (`Admin` — Toàn quyền hệ thống): Tên đăng nhập `admin` — Mật khẩu `admin123@password`
    - Tài khoản Nhân viên (`Staff` — Kinh doanh & Kỹ thuật): Tên đăng nhập `staff` — Mật khẩu `staff123@password`
