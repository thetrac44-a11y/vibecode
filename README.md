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

- **Tính năng 1 — Nhập dữ liệu nhu cầu đầu vào & Kiểm tra tên miền trực tuyến**:
  - Người dùng chọn loại website (Blog cá nhân, Giới thiệu doanh nghiệp, Shop bán hàng TMĐT, Web App/SaaS), quy mô truy cập dự kiến, ngân sách tháng và tên miền mong muốn (`.vn`, `.com`, `.com.vn`, `.shop`).
  - Công cụ tra cứu tên miền kết hợp kiểm tra DNS thực tế trên Internet (`dns.lookup`) và đối chiếu cơ sở dữ liệu đơn hàng để báo trạng thái còn trống hoặc gợi ý biến thể tên miền thay thế.
- **Tính năng 2 — AI phân tích chuyên sâu & Gợi ý gói dịch vụ tối ưu**:
  - Kết nối trực tiếp mô hình **Google Gemini (`gemini-2.5-flash`)** qua Backend Proxy để phân tích nhu cầu thực tế, đề xuất **01 gói chính phù hợp nhất** và **02 gói thay thế**, giải thích lý do chọn gói, tư vấn chiến lược bảo vệ thương hiệu tên miền và tự động lập bảng so sánh thông số kỹ thuật trực quan.
  - Hỗ trợ thêm **Trợ lý AI Telesale** tại cổng quản trị, giúp nhân viên tự động soạn kịch bản gọi điện tư vấn 3 bước cá nhân hóa theo từng đơn hàng hoặc từng khách hàng tiềm năng (`Lead`).
- **Tính năng 3 — Lưu, tra cứu, quản lý lịch sử đơn hàng & yêu cầu tư vấn**:
  - Lưu trữ đồng bộ toàn bộ đơn hàng (`Orders`), yêu cầu tư vấn (`Leads`), đánh giá dịch vụ (`Reviews`) và tài khoản trên cơ sở dữ liệu đám mây **Supabase PostgreSQL** (kèm cơ chế tự động dự phòng `db.json` và `localStorage`).
  - Khách hàng có thể xem lịch sử đơn hàng theo tài khoản đăng nhập hoặc tra cứu theo Số điện thoại, thanh toán tiếp đơn chờ, chủ động hủy đơn nháp, gia hạn chu kỳ hoặc nâng cấp gói Hosting 1-Click.
- **Tính năng 4 — Đặt mua thương mại điện tử, Thanh toán VietQR động & Hóa đơn điện tử (E-Invoice)**:
  - Tùy chỉnh chu kỳ thanh toán (`12 / 24 / 36 tháng` với chiết khấu tự động), chọn dịch vụ bổ trợ (`Add-ons`: Whois Privacy, Daily Backup, Dedicated IP), áp mã giảm giá (`VIBE2026`, `CHUSHOP`).
  - Tự động sinh mã QR chuyển khoản ngân hàng chuẩn **VietQR** khớp chính xác số tiền và nội dung chuyển khoản (`ORD-2026-XXXXX`), xuất Hóa đơn điện tử (`INV-2026-XXXXX`) hỗ trợ in ấn hoặc lưu PDF.
  - Sau khi đơn được duyệt kích hoạt, khách hàng có bảng điều khiển kỹ thuật **Quản lý Hosting (cPanel)** mô phỏng để giám sát tài nguyên (CPU/RAM/NVMe), cài đặt WordPress 1-Click, kiểm tra DNS, cấp SSL và sao lưu dữ liệu.
- **Tính năng 5 — Hệ thống Quản trị Đơn hàng, Khách hàng & Nhân sự phân quyền RBAC (`Admin` / `Staff`)**:
  - **Phân hệ Nhân viên (`Staff`)**: Tự nhận đơn (`Nhận đơn`), tự động ghi nhận người phụ trách khi xử lý đơn, lọc danh sách việc cá nhân, tạo đơn hộ khách tại quầy (`POS Quick Order`), tạo đơn gia hạn 1-Click, duyệt tiền VietQR cấp phát IP/cPanel, chăm sóc khách hàng tiềm năng (`Leads`), chuyển đổi Lead thành đơn hàng và theo dõi KPI doanh thu cùng hoa hồng 5% cá nhân.
  - **Phân hệ Quản trị viên (`Admin`)**: Bảng phân tích cơ cấu doanh thu theo gói cước, chu kỳ và nguồn thu; bảng xếp hạng KPI nhân sự; danh bạ khách hàng thành viên kèm tổng chi tiêu tích lũy (`LTV`); chỉnh sửa trực tiếp giá gói Hosting, giá đuôi tên miền, giá dịch vụ bổ trợ (`Add-ons`), mã giảm giá (`Coupons`) và cấu hình tài khoản ngân hàng nhận tiền VietQR.

## 3. Công nghệ sử dụng

| Lớp | Công nghệ (ghi đúng thứ đã dùng) |
|---|---|
| Giao diện | HTML5 / CSS3 / JavaScript (ES6+ thuần) + Tailwind CSS (CDN v3.4) |
| Thư viện & Dịch vụ tích hợp | `@supabase/supabase-js` (`^2.101.1`), `express` (`^5.2.1`), `jsonwebtoken` (`^9.0.3`), `dotenv` (`^17.3.1`), `cors` (`^2.8.6`), VietQR Image API, Google Fonts (`Inter`) |
| Lưu trữ | Backend Node.js/Express kết nối Cloud SQL **Supabase PostgreSQL** (kèm cơ chế tự động fallback về `db.json` cục bộ và `localStorage` phía trình duyệt) |
| Triển khai | Vercel (Full-stack Serverless Node.js + Static Hosting) |

## 4. Tích hợp AI

- **Chế độ đang dùng**: **API thật** (kèm cơ chế Fallback thông minh khi vượt hạn mức hoặc mất kết nối mạng)
  - API thật: **Google Gemini (`gemini-2.5-flash`)** gọi qua REST endpoint `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`.
  - Cơ chế dự phòng (Fallback): Nếu chưa cấu hình khóa `GEMINI_API_KEY` hoặc mạng gián đoạn, hệ thống tự động chuyển sang thuật toán chấm điểm quy tắc (Rule-based Scoring Engine) để đảm bảo ứng dụng luôn phản hồi 100% không bị treo.
- **Mục đích**:
  1. Phân tích thông số nhu cầu của khách hàng tại cổng mua sắm (`/api/advice`) để trả về nhận định chuyên gia, gói cước khuyên dùng và lời khuyên đăng ký tên miền.
  2. Phân tích thông tin đơn hàng và khách hàng tiềm năng tại cổng quản trị (`/api/advice/sales-script`) để soạn kịch bản gọi điện Telesale 3 bước cho nhân viên kinh doanh.
- **Bảo mật khoá API**: Không lưu bất kỳ khóa API nào ở mã nguồn phía client (`public/`). Khóa được lưu trong biến môi trường `.env` (đã đưa vào `.gitignore`) và chỉ được đọc bởi máy chủ Backend (`server.js`).

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

**Chạy ứng dụng Full-stack (Node.js + Express + Supabase/Local JSON)**

1. Giải nén file ZIP (hoặc clone kho mã nguồn) và mở Terminal tại thư mục gốc của dự án.
2. Cài đặt các gói thư viện phụ thuộc:

```bash
npm install
```

3. Tạo file môi trường `.env` từ file mẫu `.env.example` (nếu chưa điền `SUPABASE_URL` và `SUPABASE_KEY`, hệ thống sẽ tự động chạy ổn định bằng cơ sở dữ liệu cục bộ `db.json` có sẵn dữ liệu mẫu):

```bash
cp .env.example .env
```

4. Khởi chạy máy chủ:

```bash
npm start
```

5. Mở trình duyệt truy cập:
   - Cổng mua sắm dành cho Khách hàng: `http://localhost:3000/index.html`
   - Cổng quản trị OMS dành cho Admin & Staff: `http://localhost:3000/admin.html`

## 6. Cấu trúc thư mục

```text
videcode/
├── public/                     # Tài nguyên giao diện phía Client (Frontend)
│   ├── index.html              # Cổng mua sắm, AI tư vấn, tra cứu đơn & quản trị cPanel cho Khách hàng
│   ├── admin.html              # Cổng quản trị đơn hàng (OMS), Leads, Nhân sự & Cấu hình cho Admin/Staff
│   ├── css/
│   │   └── style.css           # Định dạng giao diện bổ sung, hiệu ứng và chế độ in hóa đơn (@media print)
│   └── js/
│       ├── config.js           # Cấu hình mặc định phía Client
│       ├── plans.js            # Dữ liệu danh mục gói cước dự phòng
│       ├── faq.js              # Dữ liệu câu hỏi thường gặp (FAQ Accordion)
│       ├── app.js              # Logic trang khách hàng: AI tư vấn, kiểm tra tên miền, giỏ hàng VietQR, cPanel
│       └── admin.js            # Logic trang quản trị: RBAC, duyệt đơn, quản lý Leads, KPI & cấu hình hệ thống
├── server.js                   # Máy chủ Backend Express: RESTful APIs, xác thực JWT, DNS check, Gemini AI Proxy
├── db.js                       # Tầng truy xuất dữ liệu đồng nhất: Supabase PostgreSQL + Auto-Seed + Fallback db.json
├── db.json                     # Cơ sở dữ liệu JSON cục bộ phục vụ khởi tạo mẫu (Seed) và chạy Offline
├── supabase_schema.sql         # Kịch bản SQL khởi tạo bảng trên Supabase PostgreSQL
├── vercel.json                 # Cấu hình định tuyến triển khai Serverless trên Vercel
├── .env.example                # Mẫu cấu hình biến môi trường (không chứa khóa thật)
├── package.json                # Khai báo thông tin dự án và các thư viện Node.js
└── README.md                   # Tài liệu thuyết minh, minh chứng AI và bảng kiểm thử theo mẫu BTC
```

## 7. Truy cập và phân quyền

Hệ thống áp dụng cơ chế xác thực **JWT (JSON Web Token)** kết hợp băm mật khẩu một chiều (**SHA-256 + Salt**) và phân quyền **RBAC (Role-Based Access Control)** 3 cấp độ tách biệt:

- **Khách hàng (`customer` hoặc khách vãng lai tại `/index.html`)**:
  - Khách vãng lai có thể sử dụng AI tư vấn, kiểm tra tên miền, đặt mua gói cước, quét mã VietQR và tra cứu đơn hàng bằng Số điện thoại mà không bắt buộc đăng nhập.
  - Khi đăng ký/đăng nhập tài khoản khách hàng: Hệ thống cô lập dữ liệu theo `userId`, cho phép quản lý danh sách đơn hàng riêng tư, mở bảng điều khiển kỹ thuật `cPanel`, đổi mật khẩu và gửi đánh giá dịch vụ có nhãn xác thực mua hàng (`Verified Buyer`).
- **Nhân viên (`staff` tại `/admin.html`)**:
  - Được phép xem, lọc, nhận phụ trách và duyệt kích hoạt đơn hàng; tạo đơn hộ khách (`POS`), tạo đơn gia hạn 1-Click; chăm sóc khách hàng tiềm năng (`Leads`); sử dụng công cụ AI Telesale và theo dõi bảng KPI hoa hồng cá nhân.
  - Không có quyền xóa đơn hàng, không có quyền xóa Lead và không nhìn thấy tab Cấu hình Hệ thống.
- **Quản trị viên (`admin` tại `/admin.html`)**:
  - Toàn quyền thực hiện các nghiệp vụ của `Staff`, đồng thời mở khóa tab **Quản Trị Hệ Thống & Nhân Sự (Admin)** để xem báo cáo phân tích cơ cấu doanh thu, bảng xếp hạng KPI nhân sự, danh bạ khách hàng (`LTV`), tạo/đổi mật khẩu/xóa tài khoản, điều chỉnh bảng giá gói Hosting/Tên miền/Add-ons, quản lý mã giảm giá và cấu hình tài khoản ngân hàng VietQR.

## 8. Giới hạn hiện tại

- **Xác nhận thanh toán chuyển khoản**: Mã QR được tạo tự động theo chuẩn VietQR thực tế, tuy nhiên bước đối soát sao kê ngân hàng hiện được thực hiện bán tự động (Khách hàng bấm xác nhận đã chuyển khoản -> Nhân viên/Admin kiểm tra và bấm nút duyệt kích hoạt trên OMS) thay vì dùng cổng Webhook ngân hàng trả phí.
- **Bảng điều khiển kỹ thuật Hosting (cPanel)**: Các thao tác kỹ thuật sau mua (cài đặt WordPress 1-Click, cấp chứng chỉ AutoSSL, tạo bản sao lưu `.tar.gz`, cấp địa chỉ IP máy chủ) được mô phỏng trực quan trên ứng dụng nhằm minh họa trọn vẹn vòng đời dịch vụ lưu trữ web, chưa đấu nối trực tiếp tới máy chủ WHM/cPanel vật lý.

## 9. Nguồn tham khảo

- Bộ đề thi và tiêu chí chấm giải Cuộc thi **Vibe Coding 2026** (`https://vibecoding.info.vn/tieu-chi-cham-thi`).
- Tài liệu API chính thức của Google Gemini (`https://ai.google.dev/gemini-api/docs`).
- Tài liệu SDK của Supabase PostgreSQL (`https://supabase.com/docs`) và chuẩn tạo mã thanh toán VietQR (`https://www.vietqr.io`).
- Bộ phông chữ mã nguồn mở Google Fonts (`Inter`).

## 10. Minh chứng dùng AI để xây dựng sản phẩm

Dưới đây là 03 vòng tương tác tiêu biểu trong quá trình kết hợp cùng trợ lý lập trình AI để xây dựng, kiểm thử và hoàn thiện hệ thống **HostingAdvisor v3.3**:

### Vòng 1: Xây dựng kiến trúc AI tư vấn gói cước kết hợp kiểm tra tên miền thực tế
- **Mục tiêu**: Xây dựng luồng tư vấn thông minh giúp người dùng nhập nhu cầu website và tên miền dự kiến, hệ thống vừa gợi ý gói Hosting bằng Gemini AI vừa kiểm tra xem tên miền đó có đăng ký được không.
- **Yêu cầu cho AI**: *"Thiết kế API `/api/advice` kết nối Google Gemini `gemini-2.5-flash` để phân tích nhu cầu loại web, lưu lượng, ngân sách và trả về 1 gói chính + 2 gói phụ kèm bảng so sánh; đồng thời viết API `/api/domains/check` kiểm tra tên miền trực tuyến."*
- **Vấn đề phát hiện khi thử**: Khi kiểm tra một tên miền đã có người khác mua trong hệ thống (hoặc đã tồn tại trên Internet), giao diện chỉ kiểm tra cú pháp chuỗi ký tự nên vẫn báo "Còn trống", dẫn đến trùng lặp tên miền khi đặt đơn.
- **Yêu cầu sửa**: *"Cập nhật `/api/domains/check` và `/api/orders` để kết hợp kiểm tra bản ghi DNS thực tế bằng module `dns.promises` của Node.js và đối chiếu với toàn bộ đơn hàng đã đặt trên Supabase; nếu tên miền đã có chủ sở hữu thì chặn đặt trùng và tự động gợi ý 3 tên miền thay thế (`-shop`, `-vn`, `-official`)."*
- **Kết quả kiểm tra lại**: Khi nhập tên miền đã tồn tại (ví dụ `google.com` hoặc tên miền đã có trong đơn hàng trước đó), hệ thống báo chính xác trạng thái "Đã có chủ sở hữu" kèm địa chỉ IP hoặc thông báo trùng đơn, đồng thời hiển thị danh sách tên miền gợi ý còn trống để người dùng chọn 1-Click.

### Vòng 2: Khắc phục lỗi cô lập phiên đăng nhập và dữ liệu đơn hàng giữa các tài khoản
- **Mục tiêu**: Đảm bảo tính riêng tư của đơn hàng khi nhiều người dùng khác nhau đăng nhập trên hệ thống hoặc chuyển đổi giữa cổng Khách hàng và cổng Quản trị.
- **Yêu cầu cho AI**: *"Kiểm tra luồng đăng nhập và hiển thị mục 'Đơn Hàng Của Tôi' trên `index.html` để mỗi tài khoản chỉ nhìn thấy đúng đơn hàng của mình."*
- **Vấn đề phát hiện khi thử**: Khi tài khoản A đặt hàng xong rồi đăng xuất, sau đó tài khoản B đăng nhập trên cùng trình duyệt, mục "Đơn Hàng Của Tôi" của tài khoản B vẫn hiển thị các đơn hàng cũ của tài khoản A do biến `localStorage` (`ha_last_buyer`) chưa được dọn sạch và bộ lọc Backend còn ghép theo Số điện thoại/Email cũ.
- **Yêu cầu sửa**: *"Sửa API `GET /api/orders/my-orders` trong `server.js` để khi người dùng đã đăng nhập (`tokenUser`), chỉ lọc nghiêm ngặt các đơn có `o.userId === tokenUser.id`; đồng thời xóa sạch bộ nhớ tạm của người mua trước khi đăng nhập/đăng xuất hoặc đổi tài khoản."*
- **Kết quả kiểm tra lại**: Đăng nhập thử nghiệm liên tiếp giữa các tài khoản khác nhau, mỗi tài khoản chỉ nhìn thấy chính xác các đơn hàng do chính tài khoản đó đặt mua, không còn hiện tượng rò rỉ lịch sử đơn hàng.

### Vòng 3: Hoàn thiện phân quyền RBAC (`Staff` vs `Admin`) và tối ưu giao diện di động (Mobile Responsive)
- **Mục tiêu**: Tách biệt rõ nghiệp vụ của Nhân viên kinh doanh (`Staff`) và Quản trị viên (`Admin`) trên cổng OMS (`admin.html`), đồng thời hiển thị chuẩn trên cả máy tính lẫn điện thoại.
- **Yêu cầu cho AI**: *"Bổ sung bộ công cụ tác nghiệp cho Staff (Nhận đơn, Tạo đơn hộ khách POS, Gia hạn 1-Click, KPI hoa hồng 5%) và gom toàn bộ tính năng cấu hình hệ thống, bảng xếp hạng nhân sự, phân tích doanh thu, chỉnh sửa bảng giá vào tab riêng chỉ Admin mới thấy."*
- **Vấn đề phát hiện khi thử**: Khi mở trang `admin.html` trên màn hình điện thoại di động (`360px - 412px`), thanh thông tin người dùng (`#admin-user-bar`) trên Header không tự xuống dòng làm tràn khung nhìn ngang, và khi có nhiều đơn hàng mới phát sinh thì các đơn cũ bị đẩy sâu xuống dưới.
- **Yêu cầu sửa**: *"Bổ sung phân trang (`6 đơn/trang` + nút `Xem tất cả`) và bộ lọc sắp xếp (`Mới nhất`, `Cũ nhất`, `Ưu tiên đơn chờ duyệt`) cho bảng đơn hàng; thêm `flex-wrap`, `min-w-0` và `overflow-x: hidden` cho thanh Header cùng khung bảng trên `admin.html`."*
- **Kết quả kiểm tra lại**: Giao diện trên điện thoại di động vừa khít 100% chiều ngang màn hình, không còn khoảng trắng dư bên phải; bảng đơn hàng hiển thị rõ tổng số đơn và chuyển trang mượt mà.

## 11. Bảng kiểm thử

Bảng kiểm thử dưới đây gồm **08 ca kiểm thử thực tế** (3 ca bình thường, 3 ca đầu vào không hợp lệ, 2 ca biên/sự cố), đáp ứng đầy đủ yêu cầu của **Bảng A**:

| Mã ca | Loại ca | Dữ liệu và bước thử | Kỳ vọng | Kết quả thực tế | Đạt/Chưa đạt |
|---|---|---|---|---|---|
| **TC01** | Bình thường | **Khảo sát AI tư vấn chọn gói**: Tại `index.html`, chọn loại web `Shop bán hàng / TMĐT`, lưu lượng `10.000 - 30.000 lượt/tháng`, ngân sách `150.000`, tên miền `yenboutique` + `.vn`, bấm **Nhận Tư Vấn Từ AI**. | Hệ thống gọi `/api/advice`, hiển thị nhận định từ Gemini AI, đề xuất 01 gói chính (`Business` hoặc `Shop Pro`) kèm 02 gói thay thế và bảng so sánh 3 gói. | Hiển thị đầy đủ lời khuyên AI cá nhân hóa, thẻ gói chính, 2 gói thay thế và bảng so sánh thông số kỹ thuật. | **Đạt** |
| **TC02** | Bình thường | **Đặt hàng, áp Coupon & tạo mã VietQR**: Bấm chọn mua gói `Business`, chọn chu kỳ `12 tháng`, tích thêm dịch vụ `Daily Backup`, nhập mã `VIBE2026` (giảm 15%), điền Họ tên `Nguyễn Hoàng Yến`, SĐT `0912345678`, bấm **Xác Nhận Đặt Đơn**. | Hệ thống tính đúng giảm giá 15%, khởi tạo đơn `ORD-2026-XXXXX` trên Supabase, hiển thị mã QR ngân hàng VietQR đúng số tiền và cho phép mở Hóa đơn điện tử `INV-2026-XXXXX`. | Đơn hàng được lưu vào Supabase, mã VietQR hiển thị chính xác số tiền sau giảm giá và nội dung mã đơn, in được hóa đơn. | **Đạt** |
| **TC03** | Bình thường | **Staff/Admin duyệt tiền & cấp cPanel**: Đăng nhập `admin.html`, mở đơn vừa đặt, bấm **Xác Nhận Tiền Về & Kích Hoạt Dịch Vụ**. Sau đó quay lại `index.html` mở mục **Quản Lý Hosting (cPanel)** của đơn đó. | Đơn chuyển sang `Đã kích hoạt (Paid)`, tự động sinh IP Hosting, cặp Nameservers và tài khoản/mật khẩu `cPanel`. Khách hàng mở được bảng điều khiển `cPanel` trên trang chủ. | Trạng thái đơn cập nhật thành công trên Cloud SQL, ghi nhận lịch sử `Timeline` và khách hàng sử dụng được các công cụ 1-Click trong `cPanel`. | **Đạt** |
| **TC04** | Đầu vào không hợp lệ | **Bỏ trống thông tin hoặc nhập sai SĐT khi đặt hàng**: Mở cửa sổ Thanh toán hoặc Đăng ký tư vấn, để trống Họ tên hoặc nhập Số điện thoại chỉ có 6 chữ số (`091234`) rồi bấm Gửi. | Hệ thống chặn gửi yêu cầu, hiển thị cảnh báo lỗi rõ ràng yêu cầu nhập đầy đủ Họ tên và Số điện thoại hợp lệ (10 chữ số chuẩn Việt Nam). | Hệ thống hiển thị thông báo lỗi màu đỏ ngay tại biểu mẫu, không tạo đơn hàng rác lên cơ sở dữ liệu. | **Đạt** |
| **TC05** | Đầu vào không hợp lệ | **Nhập mã giảm giá không tồn tại & đăng ký tên miền trùng**: Nhập mã giảm giá `MA_SAI_2026` tại giỏ hàng; hoặc nhập tên miền đã có người đăng ký ở đơn hàng trước. | Với mã giảm giá sai: báo lỗi mã không hợp lệ và giữ nguyên tổng tiền. Với tên miền đã được đăng ký: chặn tạo đơn trùng và gợi ý các biến thể tên miền còn trống. | Báo lỗi rõ ràng cho cả 2 trường hợp; công cụ tên miền tự động gợi ý các đuôi và hậu tố (`-shop.vn`, `-official.vn`) còn trống. | **Đạt** |
| **TC06** | Đầu vào không hợp lệ | **Kiểm tra phân quyền bảo mật RBAC**: Dùng tài khoản Khách hàng (`customer`) đăng nhập vào `admin.html`, hoặc dùng tài khoản Nhân viên (`staff`) gọi API xóa đơn hàng / sửa bảng giá của Admin. | Tài khoản Khách hàng bị từ chối đăng nhập vào cổng OMS. Tài khoản `Staff` không thấy tab Cấu hình Hệ thống và bị chặn bởi middleware `requireRole(['admin'])` (trả về mã `403 Forbidden`). | Hệ thống chặn truy cập đúng phân quyền, bảo vệ an toàn dữ liệu cấu hình và nhân sự. | **Đạt** |
| **TC07** | Ca biên / Sự cố | **Ngắt khóa Gemini AI hoặc vượt hạn mức API (Rate Limit / Offline)**: Thử gửi yêu cầu tư vấn khi biến môi trường `GEMINI_API_KEY` bị để trống hoặc dịch vụ AI bên ngoài phản hồi lỗi. | Hệ thống không bị văng lỗi `500` hay treo giao diện, tự động kích hoạt bộ máy chấm điểm dự phòng (Rule-based Fallback) để trả về gợi ý gói cước và kịch bản Telesale hợp lệ. | Giao diện vẫn trả về kết quả tư vấn gói cước và bảng so sánh mượt mà trong dưới 1 giây, không làm gián đoạn trải nghiệm người dùng. | **Đạt** |
| **TC08** | Ca biên / Sự cố | **Mất kết nối Cloud SQL hoặc chạy local chưa cấu hình `.env`**: Khởi chạy ứng dụng trên máy mới khi chưa cấu hình `SUPABASE_URL` và `SUPABASE_KEY` trong file `.env`. | Tầng dữ liệu `db.js` tự động phát hiện và chuyển sang đọc/ghi trên cơ sở dữ liệu JSON cục bộ (`db.json`) mà không làm sập máy chủ `server.js`. | Ứng dụng khởi động thành công tại `http://localhost:3000`, đầy đủ 6 gói cước mẫu, mã giảm giá và tài khoản demo để kiểm thử ngay. | **Đạt** |

## 12. Hồ sơ bàn giao

- **Source ZIP**: Chứa toàn bộ mã nguồn Full-stack, kịch bản `supabase_schema.sql`, dữ liệu khởi tạo `db.json`, cấu hình mẫu `.env.example` và tài liệu `README.md` này (tuyệt đối không chứa khóa API thật trong mã nguồn).
- **Tài khoản & Dữ liệu Demo phục vụ Ban Giám Khảo chấm thi**:
  - **Cổng Mua Sắm Khách Hàng (`/index.html`)**:
    - Tài khoản Khách hàng mẫu: Tên đăng nhập `hoangyen` — Mật khẩu `123456@password` (hoặc tự đăng ký tài khoản mới / đặt hàng trực tiếp không cần đăng nhập).
    - Mã giảm giá thử nghiệm: `VIBE2026` (Giảm 15% tổng đơn), `CHUSHOP` (Giảm trực tiếp 50.000đ).
  - **Cổng Quản Trị Đơn Hàng & Doanh Thu OMS (`/admin.html`)**:
    - Tài khoản Quản trị viên (`Admin` — Toàn quyền): Tên đăng nhập `admin` — Mật khẩu `admin123@password`
    - Tài khoản Nhân viên (`Staff` — Kinh doanh & Kỹ thuật): Tên đăng nhập `staff` — Mật khẩu `staff123@password`
