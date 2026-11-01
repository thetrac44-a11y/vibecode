# Vibe-Coding 2026, Đề 1: AI Tư Vấn Hosting/Domain & Nền Tảng Thương Mại Điện Tử Quản Trị Đơn Hàng (OMS)

Tài liệu tổng hợp: Kế hoạch dự án, kiến trúc hệ thống, mô hình dữ liệu `db.json`, phân quyền RBAC 3 cấp, quy trình thanh toán VietQR động, tính năng mua bán e-commerce hoàn chỉnh, prompt cho AI, bộ prompt Vibe Coding từng bước và checklist kiểm thử toàn diện.

**Bản v3.3 (E-Commerce Edition)** — Đầy đủ tính năng của một trang thương mại điện tử chuyên nghiệp:
- **Mua bán trực tiếp & AI Trợ lý Mua sắm (AI Buying Assistant)**: Xem toàn bộ danh mục 6 gói Hosting & Tên miền để bấm "Mua ngay" trực tiếp, hoặc dùng AI tư vấn nếu chưa rõ nhu cầu.
- **Dịch vụ mua kèm (Add-ons / Cross-sell)**: Bảo vệ ẩn danh Whois tên miền, Sao lưu dữ liệu hằng ngày, IP riêng.
- **Hệ thống Mã giảm giá (Coupon Code)**: Nhập mã khuyến mãi (`VIBE2026`, `CHUSHOP`) giảm trực tiếp tiền đơn hàng và cập nhật mã VietQR tức thì.
- **Hóa đơn điện tử (E-Invoice / Receipt)**: Xem hóa đơn chi tiết, dấu mộc điện tử "ĐÃ THANH TOÁN (PAID)" và nút "In hóa đơn / Lưu PDF".
- **Yếu tố uy tín (Trust Badges & Reviews)**: Cam kết hoàn tiền 30 ngày, Uptime 99.9%, hỗ trợ 24/7 và đánh giá thực tế từ khách hàng.
- **Phân quyền RBAC 3 cấp độ (`admin`, `staff`, `customer`)**: Khách hàng đăng ký tài khoản, quản lý giỏ hàng, lịch sử đơn và thông số kỹ thuật hosting.
- **Cơ chế thanh toán VietQR ngân hàng động**: Tự động sinh mã QR đúng số tiền & cú pháp đơn hàng, hỗ trợ duyệt thanh toán kích hoạt dịch vụ tự động.
- **Chạy Local 100% bằng Node.js/Express + `db.json`**: Bỏ hoàn toàn Vercel và Supabase, bảo mật Gemini API key qua `.env`.

---

## 0. Chốt kiến trúc & Kỹ thuật cốt lõi

| Quyết định | Giải pháp chốt | Lý do kỹ thuật |
|---|---|---|
| **Mô hình Mua bán (E-Commerce)** | **Catalog mua trực tiếp + AI tư vấn song song** | Khách am hiểu có thể xem bảng giá mua ngay; khách mới dùng AI tư vấn gợi ý. |
| **Dịch vụ gia tăng (Add-ons)** | **Tích chọn: Whois Privacy, Backup, IP riêng** | Gia tăng giá trị đơn hàng thực tế theo chuẩn ngành dịch vụ Hosting/Domain. |
| **Mã ưu đãi (Coupons)** | **Bảng `coupons` trong `db.json`** | Khách nhập mã giảm giá (`VIBE2026` giảm 15%), trừ tiền trực tiếp trên giao diện và mã QR. |
| **Hóa đơn điện tử (Invoice)** | **Modal Invoice chuẩn hóa + CSS Print (`@media print`)** | Xem biên lai chi tiết, có dấu mộc điện tử "PAID", bấm in hoặc lưu PDF dễ dàng. |
| **Phân quyền 3 Role (RBAC)** | **Admin - Staff - Customer** | Khách hàng đăng ký/đăng nhập để mua, bảo mật đơn hàng cá nhân; Staff/Admin quản trị. |
| **Thanh toán VietQR động** | **API VietQR tự động theo số tiền & mã đơn** | Tự động sinh QR kèm số tiền và cú pháp `ORD-2026-XXX`, rất thực tế và chuyên nghiệp. |
| **Cơ sở dữ liệu** | **`db.json` cục bộ** | Lưu trữ toàn bộ `plans`, `domain_pricing`, `addons`, `coupons`, `orders`, `users`. |
| **Bảo mật Gemini Key** | **Biến môi trường `.env` qua Express Server** | API Key nằm 100% ở server local, proxy qua `/api/advice` và `/api/advice/sales-script`. |

---

## 1. Sơ đồ Luồng Mua Sắm & Quản Trị Đơn Hàng

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│             NỀN TẢNG MUA BÁN HOSTING/DOMAIN & QUẢN TRỊ ĐƠN HÀNG (OMS)                  │
├───────────────────────────────────────────┬────────────────────────────────────────────┤
│         1. CỔNG MUA SẮM (index.html)      │         2. CỔNG QUẢN TRỊ (admin.html)      │
├───────────────────────────────────────────┼────────────────────────────────────────────┤
│ • Header: Đăng nhập/Đăng ký, Giỏ & Đơn tôi│ • Đăng nhập & Xác thực JWT Token           │
│ • Catalog 6 gói Hosting & Bảng giá Tên miề│ • Phân quyền RBAC (Admin / Staff)          │
│ • "Mua Ngay" trực tiếp hoặc "AI Tư Vấn"   │ • Dashboard Doanh thu thực nhận & Chờ duyệt│
│ • Tích chọn Add-ons: Backup, Whois, IP    │ • Duyệt thanh toán đơn ("Xác nhận nhận tiền")│
│ • Nhập mã giảm giá Coupon (VIBE2026)      │ • AI Trợ lý Telesale: Tạo kịch bản chốt đơn│
│ • Quét mã VietQR thanh toán tự động       │ • Phân công nhân viên & Quản lý đơn hàng   │
│ • Xem & In Hóa Đơn Điện Tử (Invoice)      │ • Xuất báo cáo tài chính ra file CSV       │
│ • Cam kết hoàn tiền 30 ngày & Reviews     │ • Xem timeline nhật ký vết đơn hàng        │
└───────────────────────────────────────────┴────────────────────────────────────────────┘
                                             │
                                             ▼
             ┌───────────────────────────────────────────────────────────┐
             │            Node.js / Express Backend Server               │
             │   - /api/auth (Register, Login, Me)                       │
             │   - /api/orders (Tạo đơn, VietQR, Xác nhận, Duyệt tiền)   │
             │   - /api/coupons/validate (Kiểm tra mã giảm giá)          │
             │   - /api/advice (AI tư vấn gói & tên miền)                │
             │   - /api/advice/sales-script (AI tạo kịch bản telesale)   │
             └───────────────────────────────────────────────────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             ┌───────────────────┐                       ┌───────────────────┐
             │      db.json      │                       │   Google Gemini   │
             │  - users          │                       │   (gemini-2.5)    │
             │  - plans          │                       │   Qua .env Key    │
             │  - domain_pricing │                       └───────────────────┘
             │  - addons         │
             │  - coupons        │
             │  - orders         │
             └───────────────────┘
```

---

## 2. Kiến trúc Thư mục Dự án

```
vibe-hosting-advisor/
├── .env                  # Chứa GEMINI_API_KEY, PORT=3000, JWT_SECRET (không commit)
├── .env.example          # File mẫu cấu hình môi trường
├── .gitignore            # Bỏ qua node_modules, .env
├── package.json          # Quản lý script và dependencies
├── server.js             # Express server (Proxy AI, REST API Orders, Coupons, Auth, QR)
├── db.json               # CSDL chính (plans, domain_pricing, addons, coupons, orders, users)
│
├── public/               # Thư mục client frontend
│   ├── index.html        # Trang mua bán chính: Catalog, AI Tư vấn, Checkout VietQR, Invoice
│   ├── admin.html        # Trang quản trị: Dashboard OMS, Duyệt tiền, Phân công, Telesale AI
│   ├── css/
│   │   └── style.css     # Style giao diện, modal hóa đơn, CSS in ấn (@media print)
│   └── js/
│       ├── config.js     # Cấu hình API endpoint
│       ├── plans.js      # Danh mục 6 gói Hosting mẫu
│       ├── domains.js    # Bảng giá tra cứu tên miền
│       ├── addons.js     # Danh mục các dịch vụ mua kèm (Whois, Backup, IP)
│       ├── faq.js        # Dữ liệu hỏi đáp Hosting/Domain
│       ├── app.js        # Logic mua sắm (Auth khách, Chọn gói, Coupon, VietQR, Invoice)
│       └── admin.js      # Logic quản trị (Auth admin/staff, Duyệt tiền, AI Telesale, CSV)
```

---

## 3. Thiết kế Cơ sở Dữ liệu (`db.json`)

File `db.json` chứa 6 bảng dữ liệu đầy đủ nghiệp vụ thương mại điện tử:

```json
{
  "users": [
    {
      "id": "usr_admin",
      "username": "admin",
      "password": "admin123@password",
      "fullName": "Nguyễn Quản Trị",
      "phone": "0901000001",
      "email": "admin@hostingadvisor.vn",
      "role": "admin",
      "createdAt": "2026-01-01T08:00:00.000Z"
    },
    {
      "id": "usr_staff",
      "username": "staff",
      "password": "staff123@password",
      "fullName": "Trần Tư Vấn",
      "phone": "0901000002",
      "email": "staff@hostingadvisor.vn",
      "role": "staff",
      "createdAt": "2026-01-01T08:30:00.000Z"
    },
    {
      "id": "usr_cust_01",
      "username": "hoangyen",
      "password": "123456@password",
      "fullName": "Lê Hoàng Yến",
      "phone": "0988123456",
      "email": "hoangyen.boutique@gmail.com",
      "role": "customer",
      "createdAt": "2026-10-26T08:00:00.000Z"
    }
  ],
  "coupons": [
    {
      "code": "VIBE2026",
      "type": "percent",
      "value": 15,
      "description": "Giảm ngay 15% tổng hóa đơn nhân dịp Vibe Coding 2026"
    },
    {
      "code": "CHUSHOP",
      "type": "fixed",
      "value": 50000,
      "description": "Ưu đãi trực tiếp 50.000đ cho chủ shop khởi nghiệp"
    }
  ],
  "addons": [
    {
      "id": "addon_whois",
      "name": "Bảo Vệ Ẩn Danh Tên Miền (Whois Privacy)",
      "price": 50000,
      "billingType": "yearly",
      "description": "Ẩn thông tin cá nhân và SĐT của bạn trên dữ liệu công khai Whois"
    },
    {
      "id": "addon_backup",
      "name": "Sao Lưu Dữ Liệu Tự Động Hằng Ngày (Daily Backup)",
      "price": 30000,
      "billingType": "monthly",
      "description": "Tự động sao lưu website vào 0h mỗi đêm, khôi phục với 1 click"
    },
    {
      "id": "addon_ip",
      "name": "Địa Chỉ IP Riêng Chuyên Dụng (Dedicated IP)",
      "price": 80000,
      "billingType": "monthly",
      "description": "IP độc lập giúp uy tín email và tối ưu SEO vượt trội"
    }
  ],
  "domain_pricing": [
    { "extension": ".com", "price": 280000, "description": "Tên miền quốc tế phổ biến nhất" },
    { "extension": ".vn", "price": 550000, "description": "Tên miền quốc gia Việt Nam uy tín" },
    { "extension": ".com.vn", "price": 450000, "description": "Doanh nghiệp thương mại Việt Nam" },
    { "extension": ".shop", "price": 190000, "description": "Cửa hàng bán lẻ trực tuyến" }
  ],
  "plans": [
    {
      "id": "starter",
      "name": "Starter",
      "type": "Shared Hosting",
      "pricePerMonth": 39000,
      "storage": "5 GB SSD",
      "bandwidth": "50 GB/tháng",
      "recommendedVisits": 3000,
      "freeDomain": false,
      "features": ["1 website", "SSL miễn phí", "1 email doanh nghiệp"],
      "bestFor": "Blog cá nhân, trang giới thiệu nhỏ"
    },
    {
      "id": "basic",
      "name": "Basic",
      "type": "Shared Hosting",
      "pricePerMonth": 69000,
      "storage": "20 GB SSD",
      "bandwidth": "200 GB/tháng",
      "recommendedVisits": 10000,
      "freeDomain": true,
      "features": ["3 website", "SSL miễn phí", "Tặng tên miền .com/.vn năm đầu", "5 email doanh nghiệp"],
      "bestFor": "Trang giới thiệu doanh nghiệp, shop nhỏ mới bắt đầu"
    },
    {
      "id": "business",
      "name": "Business",
      "type": "Shared Hosting",
      "pricePerMonth": 129000,
      "storage": "50 GB NVMe",
      "bandwidth": "Không giới hạn",
      "recommendedVisits": 30000,
      "freeDomain": true,
      "features": ["10 website", "SSL miễn phí", "Tặng tên miền năm đầu", "Sao lưu hằng tuần", "Tăng tốc LiteSpeed"],
      "bestFor": "Shop online vừa, nhiều ảnh sản phẩm"
    },
    {
      "id": "shop-pro",
      "name": "Shop Pro",
      "type": "Cloud Hosting",
      "pricePerMonth": 249000,
      "storage": "100 GB NVMe",
      "bandwidth": "Không giới hạn",
      "recommendedVisits": 80000,
      "freeDomain": true,
      "features": ["Tối ưu WooCommerce", "Sao lưu hằng ngày", "CDN miễn phí", "Tặng tên miền năm đầu", "Hỗ trợ ưu tiên"],
      "bestFor": "Shop bán hàng đông khách, có chạy quảng cáo"
    },
    {
      "id": "vps-1",
      "name": "VPS Growth",
      "type": "VPS",
      "pricePerMonth": 399000,
      "storage": "80 GB NVMe",
      "bandwidth": "1 TB/tháng",
      "recommendedVisits": 150000,
      "freeDomain": false,
      "features": ["2 CPU, 4 GB RAM", "Toàn quyền quản trị", "Sao lưu hằng ngày", "Tự cài phần mềm theo ý"],
      "bestFor": "Website lượng truy cập cao, cần tuỳ biến sâu"
    },
    {
      "id": "vps-2",
      "name": "VPS Power",
      "type": "VPS",
      "pricePerMonth": 799000,
      "storage": "160 GB NVMe",
      "bandwidth": "3 TB/tháng",
      "recommendedVisits": 500000,
      "freeDomain": false,
      "features": ["4 CPU, 8 GB RAM", "Toàn quyền quản trị", "Sao lưu hằng ngày", "IP riêng"],
      "bestFor": "Báo điện tử, sàn thương mại, lượng truy cập lớn"
    }
  ],
  "orders": [
    {
      "id": "ORD-2026-001",
      "customerId": "usr_cust_01",
      "customerName": "Lê Hoàng Yến",
      "phone": "0988123456",
      "email": "hoangyen.boutique@gmail.com",
      "planChosen": "business",
      "planName": "Business",
      "planPrice": 129000,
      "domainName": "yenboutique.vn",
      "domainExtension": ".vn",
      "domainPrice": 550000,
      "isDomainFree": true,
      "billingCycleMonths": 12,
      "addons": [
        { "id": "addon_whois", "name": "Bảo Vệ Ẩn Danh Whois", "price": 50000 }
      ],
      "couponApplied": "VIBE2026",
      "discountAmount": 239700,
      "subTotal": 1598000,
      "totalAmount": 1358300,
      "paymentMethod": "vietqr",
      "paymentStatus": "paid",
      "status": "completed",
      "assignedTo": "usr_staff",
      "assignedToName": "Trần Tư Vấn",
      "serviceDetails": {
        "hostingIp": "103.145.62.88",
        "nameServers": ["ns1.hostingadvisor.vn", "ns2.hostingadvisor.vn"],
        "expireDate": "2027-10-26T08:15:00.000Z"
      },
      "needs": {
        "siteType": "ban-hang",
        "traffic": "10k-50k",
        "budget": 150000,
        "needDomain": true,
        "desiredDomain": "yenboutique"
      },
      "aiReason": "Gói Business đáp ứng thoải mái 30.000 khách mỗi tháng, tặng kèm tên miền .vn bảo vệ thương hiệu thời trang tại Việt Nam.",
      "aiDomainAdvice": "Tên miền .vn giúp khách hàng an tâm mua sắm online, ưu tiên SEO tại Việt Nam.",
      "notes": "Đã nhận tiền chuyển khoản lúc 08:30 và kích hoạt dịch vụ thành công",
      "timeline": [
        { "action": "Khách đặt mua gói và áp dụng mã VIBE2026", "by": "hoangyen", "time": "2026-10-26T08:15:00.000Z" },
        { "action": "Khách xác nhận đã chuyển khoản VietQR", "by": "hoangyen", "time": "2026-10-26T08:25:00.000Z" },
        { "action": "Xác nhận nhận đủ tiền 1.358.300đ & Kích hoạt gói dịch vụ", "by": "admin", "time": "2026-10-26T08:30:00.000Z" }
      ],
      "createdAt": "2026-10-26T08:15:00.000Z",
      "updatedAt": "2026-10-26T08:30:00.000Z"
    }
  ]
}
```

---

## 4. Các Tính Năng Thương Mại Điện Tử Cốt Lõi

### 4.1. Bảng Giá Sản Phẩm & Mua Ngay Trực Tiếp
- Trên trang chủ `index.html` có section **"Bảng Giá Dịch Vụ Hosting & Tên Miền"** hiển thị danh sách 6 gói chia theo danh mục (Shared, Cloud, VPS) với đầy đủ thông số và giá niêm yết.
- Người dùng có thể bấm trực tiếp nút **"Mua Ngay"** trên bất kỳ gói nào mà không cần qua bước làm khảo sát.
- Công cụ khảo sát AI hoạt động như một **"Shopping Assistant (Trợ lý tư vấn ảo)"** nằm ở vị trí trang trọng giúp người dùng chưa có kinh nghiệm dễ dàng đưa ra quyết định.

### 4.2. Dịch vụ Mua Kèm (Add-ons)
Khi mở Modal Đặt hàng, khách hàng có thể tích chọn thêm các dịch vụ bổ trợ:
1. `Bảo vệ ẩn danh tên miền (Whois Privacy)`: 50.000đ/năm.
2. `Sao lưu dữ liệu tự động hằng ngày (Daily Backup)`: 30.000đ/tháng (x số tháng của chu kỳ).
3. `Địa chỉ IP riêng chuyên dụng (Dedicated IP)`: 80.000đ/tháng (x số tháng của chu kỳ).
- Khi tích/bỏ tích, số tiền hóa đơn tự động cập nhật ngay trên màn hình.

### 4.3. Hệ thống Mã Giảm Giá (Coupon System)
- Khách hàng nhập mã khuyến mãi vào ô **"Mã giảm giá"**:
  - `VIBE2026`: Giảm 15% tổng đơn hàng.
  - `CHUSHOP`: Giảm trực tiếp 50.000đ.
- Bấm **"Áp Dụng"**: Hệ thống gửi request xác thực tới `/api/coupons/validate`, hiển thị thông báo thành công màu xanh, hiển thị dòng tiền trừ giảm giá (`-239.700đ`) và **cập nhật lại mã VietQR** với số tiền đã trừ.

### 4.4. Hóa Đơn Điện Tử (E-Invoice / Receipt)
- Tại mục "Đơn hàng của tôi" hoặc sau khi thanh toán thành công, khách bấm **"Xem Hóa Đơn"**:
  - Mở Modal Hóa Đơn thương mại điện tử chuyên nghiệp:
    - Tiêu đề: **HÓA ĐƠN DỊCH VỤ ĐIỆN TỬ (ELECTRONIC INVOICE)**.
    - Mã hóa đơn: `INV-2026-001`, Ngày lập, Thời hạn thanh toán.
    - Đơn vị cung cấp: HOSTING ADVISOR CORP (MST: 0109999999).
    - Khách hàng: Tên, SĐT, Email.
    - Bảng chi tiết: Tên gói hosting (chu kỳ X tháng), Tên miền, Các Add-ons, Mã giảm giá.
    - Tổng tiền thanh toán & Phương thức VietQR.
    - **Con dấu điện tử**: Dấu tròn màu đỏ **"ĐÃ THANH TOÁN (PAID)"** hoặc dấu vàng **"CHỜ THANH TOÁN (UNPAID)"**.
    - Nút **"In Hóa Đơn / Lưu PDF"** (`window.print()`).

### 4.5. Yếu Tố Tạo Niềm Tin & Review Khách Hàng (Social Proof & Trust)
- **3 Cam kết vàng (Trust Badges)**:
  - 🛡️ *Cam kết hoàn tiền 100% trong 30 ngày nếu không hài lòng*.
  - ⚡ *Uptime cam kết đạt 99.9%*.
  - 🎧 *Hỗ trợ kỹ thuật 24/7/365 qua Hotline & Livechat*.
- **Section Đánh giá thực tế từ khách hàng (Customer Reviews)**:
  - Chị Lan (Chủ tiệm hoa tươi Lily): *"Trước đây web hay bị sập giờ cao điểm, đổi sang gói Business web chạy cực mượt, khách đặt hàng ầm ầm!"*
  - Anh Tuấn (Xưởng gốm Bát Tràng): *"AI tư vấn chọn đúng tên miền .vn giúp bên mình tạo niềm tin cho đối tác xuất khẩu. Rất đáng tiền!"*
  - Bạn Nam (Blog Cafe & Lifestyle): *"Giao diện dễ mua, thanh toán VietQR quét 3 giây là xong, có hóa đơn rõ ràng."*

---

## 5. Thiết kế Backend (`server.js`) - E-Commerce API

```javascript
// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret-vibe-key-2026';
const DB_FILE = path.join(__dirname, 'db.json');

const PAYMENT_CONFIG = {
  bankId: 'MB',
  accountNo: '0988123456',
  accountName: 'HOSTING ADVISOR CORP'
};

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function readDB() {
  const data = await fs.readFile(DB_FILE, 'utf-8');
  return JSON.parse(data);
}

async function writeDB(data) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ ok: false, error: 'Vui lòng đăng nhập' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ ok: false, error: 'Phiên làm việc hết hạn' });
    req.user = user;
    next();
  });
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: 'Bạn không có quyền thực hiện thao tác này' });
    }
    next();
  };
}

// ================== API AUTH & USERS ==================
app.post('/api/auth/register', async (req, res) => {
  const { username, password, fullName, phone, email } = req.body;
  if (!username || !password || !fullName || !phone) {
    return res.status(400).json({ ok: false, error: 'Vui lòng điền đủ thông tin bắt buộc' });
  }

  const phoneRegex = /^(0|\+84)\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ ok: false, error: 'Số điện thoại không hợp lệ' });
  }

  const db = await readDB();
  if (db.users.some(u => u.username === username.trim())) {
    return res.status(409).json({ ok: false, error: 'Tên đăng nhập này đã được sử dụng' });
  }

  const newUser = {
    id: 'usr_cust_' + Date.now(),
    username: username.trim(),
    password,
    fullName: fullName.trim(),
    phone: phone.trim(),
    email: email ? email.trim() : '',
    role: 'customer',
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  await writeDB(db);

  const token = jwt.sign(
    { id: newUser.id, username: newUser.username, role: newUser.role, fullName: newUser.fullName, phone: newUser.phone, email: newUser.email },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.status(201).json({ ok: true, token, user: newUser });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const db = await readDB();
  const user = db.users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, fullName: user.fullName, phone: user.phone || '', email: user.email || '' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    ok: true,
    token,
    user: { id: user.id, username: user.username, role: user.role, fullName: user.fullName, phone: user.phone, email: user.email }
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ================== API COUPONS (MÃ KHUYẾN MÃI) ==================
app.post('/api/coupons/validate', async (req, res) => {
  const { code, rawTotal } = req.body;
  if (!code) return res.status(400).json({ ok: false, error: 'Chưa nhập mã giảm giá' });

  const db = await readDB();
  const coupon = db.coupons.find(c => c.code.toUpperCase() === code.trim().toUpperCase());
  if (!coupon) return res.status(404).json({ ok: false, error: 'Mã giảm giá không tồn tại hoặc đã hết hạn' });

  let discountAmount = 0;
  if (coupon.type === 'percent') {
    discountAmount = Math.round((rawTotal * coupon.value) / 100);
  } else if (coupon.type === 'fixed') {
    discountAmount = Math.min(coupon.value, rawTotal);
  }

  res.json({
    ok: true,
    code: coupon.code,
    description: coupon.description,
    discountAmount,
    finalTotal: Math.max(0, rawTotal - discountAmount)
  });
});

// ================== API ORDERS & THANH TOÁN VIETQR ==================
app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const {
      planChosen, desiredDomain, domainExtension,
      billingCycleMonths, selectedAddons, couponCode,
      needs, aiReason, aiDomainAdvice
    } = req.body;

    const db = await readDB();
    const planInfo = db.plans.find(p => p.id === planChosen);
    if (!planInfo) return res.status(400).json({ ok: false, error: 'Gói hosting không hợp lệ' });

    const cycle = parseInt(billingCycleMonths) || 12;
    let discountCycle = 0;
    if (cycle === 24) discountCycle = 0.1;
    if (cycle === 36) discountCycle = 0.2;

    const rawHostingPrice = planInfo.pricePerMonth * cycle;
    const hostingPrice = Math.round(rawHostingPrice * (1 - discountCycle));

    let domainPrice = 0;
    let isDomainFree = false;
    let finalDomainName = '';

    if (desiredDomain && domainExtension) {
      finalDomainName = `${desiredDomain.trim().toLowerCase()}${domainExtension}`;
      const extInfo = db.domain_pricing.find(d => d.extension === domainExtension);
      const extPrice = extInfo ? extInfo.price : 280000;
      if (planInfo.freeDomain) {
        isDomainFree = true;
        domainPrice = 0;
      } else {
        domainPrice = extPrice;
      }
    }

    // Tính tiền Add-ons
    let addonsTotal = 0;
    const chosenAddons = [];
    if (Array.isArray(selectedAddons)) {
      for (const addonId of selectedAddons) {
        const addon = db.addons.find(a => a.id === addonId);
        if (addon) {
          const itemPrice = addon.billingType === 'monthly' ? addon.price * cycle : addon.price;
          addonsTotal += itemPrice;
          chosenAddons.push({ id: addon.id, name: addon.name, price: itemPrice });
        }
      }
    }

    const subTotal = hostingPrice + domainPrice + addonsTotal;

    // Áp dụng mã coupon nếu có
    let discountAmount = 0;
    let finalCoupon = null;
    if (couponCode) {
      const coupon = db.coupons.find(c => c.code.toUpperCase() === couponCode.trim().toUpperCase());
      if (coupon) {
        finalCoupon = coupon.code;
        if (coupon.type === 'percent') discountAmount = Math.round((subTotal * coupon.value) / 100);
        else if (coupon.type === 'fixed') discountAmount = Math.min(coupon.value, subTotal);
      }
    }

    const totalAmount = Math.max(0, subTotal - discountAmount);
    const orderCount = db.orders.length + 1;
    const orderId = `ORD-2026-${String(orderCount).padStart(3, '0')}`;

    const qrUrl = `https://img.vietqr.io/image/${PAYMENT_CONFIG.bankId}-${PAYMENT_CONFIG.accountNo}-compact2.png?amount=${totalAmount}&addInfo=${orderId}&accountName=${encodeURIComponent(PAYMENT_CONFIG.accountName)}`;

    const newOrder = {
      id: orderId,
      customerId: req.user.id,
      customerName: req.user.fullName,
      phone: req.user.phone || '',
      email: req.user.email || '',
      planChosen,
      planName: planInfo.name,
      planPrice: planInfo.pricePerMonth,
      domainName: finalDomainName,
      domainExtension: domainExtension || '',
      domainPrice,
      isDomainFree,
      billingCycleMonths: cycle,
      addons: chosenAddons,
      couponApplied: finalCoupon,
      discountAmount,
      subTotal,
      totalAmount,
      qrUrl,
      paymentMethod: 'vietqr',
      paymentStatus: 'unpaid',
      status: 'pending_payment',
      assignedTo: null,
      assignedToName: 'Chưa phân công',
      serviceDetails: null,
      notes: '',
      timeline: [
        {
          action: 'Khách hàng tạo đơn mua hàng, chờ thanh toán VietQR',
          by: req.user.username,
          time: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.orders.unshift(newOrder);
    await writeDB(db);

    res.status(201).json({ ok: true, order: newOrder });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Lỗi máy chủ khi tạo đơn hàng' });
  }
});

// Khách báo đã chuyển khoản
app.post('/api/orders/:id/confirm-payment', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const db = await readDB();
  const order = db.orders.find(o => o.id === id);

  if (!order) return res.status(404).json({ ok: false, error: 'Không tìm thấy đơn hàng' });
  if (req.user.role === 'customer' && order.customerId !== req.user.id) {
    return res.status(403).json({ ok: false, error: 'Bạn không có quyền thao tác trên đơn này' });
  }

  order.status = 'paid_processing';
  order.timeline.push({
    action: 'Khách hàng xác nhận đã chuyển khoản VietQR, đang chờ duyệt tiền',
    by: req.user.username,
    time: new Date().toISOString()
  });
  order.updatedAt = new Date().toISOString();

  await writeDB(db);
  res.json({ ok: true, order });
});

// Khách xem danh sách đơn của mình
app.get('/api/orders/my-orders', authenticateToken, async (req, res) => {
  const db = await readDB();
  const myOrders = db.orders.filter(o => o.customerId === req.user.id);
  res.json({ ok: true, orders: myOrders });
});

// Admin & Staff xem toàn bộ đơn hàng
app.get('/api/orders', authenticateToken, authorizeRoles('admin', 'staff'), async (req, res) => {
  const db = await readDB();
  res.json({ ok: true, orders: db.orders });
});

// Admin & Staff duyệt thanh toán / cập nhật trạng thái
app.patch('/api/orders/:id', authenticateToken, authorizeRoles('admin', 'staff'), async (req, res) => {
  const { id } = req.params;
  const { status, notes, assignedTo } = req.body;
  const db = await readDB();
  const order = db.orders.find(o => o.id === id);

  if (!order) return res.status(404).json({ ok: false, error: 'Không tìm thấy đơn hàng' });

  if (status) {
    order.status = status;
    if (status === 'completed') {
      order.paymentStatus = 'paid';
      order.serviceDetails = {
        hostingIp: '103.145.62.' + Math.floor(Math.random() * 200 + 10),
        nameServers: ['ns1.hostingadvisor.vn', 'ns2.hostingadvisor.vn'],
        expireDate: new Date(Date.now() + order.billingCycleMonths * 30 * 24 * 60 * 60 * 1000).toISOString()
      };
      order.timeline.push({
        action: `Xác nhận nhận đủ ${order.totalAmount.toLocaleString()}đ & Kích hoạt gói dịch vụ`,
        by: req.user.username,
        time: new Date().toISOString()
      });
    } else {
      order.timeline.push({
        action: `Cập nhật trạng thái đơn: ${status}`,
        by: req.user.username,
        time: new Date().toISOString()
      });
    }
  }

  if (notes !== undefined) order.notes = notes;

  if (assignedTo !== undefined && req.user.role === 'admin') {
    const staff = db.users.find(u => u.id === assignedTo);
    order.assignedTo = assignedTo;
    order.assignedToName = staff ? staff.fullName : 'Chưa phân công';
    order.timeline.push({
      action: `Phân công đơn cho: ${order.assignedToName}`,
      by: req.user.username,
      time: new Date().toISOString()
    });
  }

  order.updatedAt = new Date().toISOString();
  await writeDB(db);
  res.json({ ok: true, order });
});

// Xóa đơn (Chỉ Admin)
app.delete('/api/orders/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const db = await readDB();
  const before = db.orders.length;
  db.orders = db.orders.filter(o => o.id !== id);

  if (db.orders.length === before) {
    return res.status(404).json({ ok: false, error: 'Không tìm thấy đơn hàng' });
  }

  await writeDB(db);
  res.json({ ok: true, message: 'Đã xóa đơn hàng' });
});

// ================== API PROXY AI GEMINI ==================
app.post('/api/advice', async (req, res) => {
  const { systemPrompt, userMessage, planIds } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ ok: false, error: 'Chưa cấu hình GEMINI_API_KEY' });

  const MODEL = 'gemini-2.5-flash';
  const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const schema = {
    type: 'object',
    properties: {
      best: {
        type: 'object',
        properties: { planId: { type: 'string', enum: planIds }, reason: { type: 'string' } },
        required: ['planId', 'reason']
      },
      alternatives: {
        type: 'array',
        minItems: 2,
        maxItems: 2,
        items: {
          type: 'object',
          properties: { planId: { type: 'string', enum: planIds }, reason: { type: 'string' } },
          required: ['planId', 'reason']
        }
      },
      domainAdvice: { type: 'string' }
    },
    required: ['best', 'alternatives', 'domainAdvice']
  };

  try {
    const aiRes = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.3,
          maxOutputTokens: 1200,
          thinkingConfig: { thinkingBudget: 0 }
        }
      }),
      signal: AbortSignal.timeout(14000)
    });

    if (!aiRes.ok) return res.status(502).json({ ok: false, error: 'Lỗi từ Gemini AI' });
    const data = await aiRes.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    res.json({ ok: true, raw });
  } catch (err) {
    res.status(504).json({ ok: false, error: 'Timeout khi gọi AI' });
  }
});

// AI Telesale Script
app.post('/api/advice/sales-script', authenticateToken, authorizeRoles('admin', 'staff'), async (req, res) => {
  const { orderId } = req.body;
  const db = await readDB();
  const order = db.orders.find(o => o.id === orderId);
  if (!order) return res.status(404).json({ ok: false, error: 'Không tìm thấy đơn hàng' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ ok: false, error: 'Thiếu API Key' });

  const prompt = `Soạn kịch bản gọi điện chốt đơn ngắn gọn 3 bước cho nhân viên:
Khách hàng: ${order.customerName} (SĐT: ${order.phone})
Gói chọn: ${order.planName}, Tên miền: ${order.domainName || 'Không có'}
Tổng tiền: ${order.totalAmount.toLocaleString()}đ (${order.billingCycleMonths} tháng).
Add-ons: ${order.addons && order.addons.length ? order.addons.map(a => a.name).join(', ') : 'Không có'}.
Trạng thái: ${order.status}.
Viết 3 bước súc tích, văn phong tự nhiên bằng tiếng Việt.`;

  try {
    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(12000)
    });
    const data = await aiRes.json();
    const script = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    res.json({ ok: true, script });
  } catch (err) {
    res.status(504).json({ ok: false, error: 'Lỗi gọi AI script' });
  }
});

app.listen(PORT, () => {
  console.log(`Server thương mại điện tử chạy tại: http://localhost:${PORT}`);
  console.log(`- Portal Khách: http://localhost:${PORT}/index.html`);
  console.log(`- Portal Admin: http://localhost:${PORT}/admin.html`);
});
```

---

## 6. Giao diện Người dùng Mua Sắm (UI/UX)

### 6.1. Trang Mua Sắm Khách Hàng (`public/index.html`)
1. **Header & Navigation Bar**:
   - Logo thương hiệu HostingAdvisor.
   - Menu: **"Bảng Giá Gói"**, **"AI Tư Vấn"**, **"Hỏi Đáp"**, **"Đánh Giá"**.
   - Cụm Auth: Nút "Đăng Nhập / Đăng Ký" hoặc "Chào, [Tên]" + Nút "Đơn Hàng Của Tôi" + Nút "Cổng Quản Trị".
2. **Hero & AI Shopping Assistant**:
   - Tiêu đề cuốn hút: "Nền Tảng Đăng Ký Hosting & Tên Miền Tốc Độ Cao Cho Doanh Nghiệp".
   - Form khảo sát thông minh cho khách hàng chưa biết chọn gói.
3. **Bảng Giá Toàn Bộ 6 Gói Hosting (Direct Product Catalog)**:
   - Thẻ hiển thị 6 gói chia theo danh mục (Shared, Cloud, VPS) có nút **"Mua Ngay"** trực tiếp.
4. **Modal Đặt Mua & Thanh Toán E-Commerce**:
   - Chọn Chu kỳ (1 Năm / 2 Năm giảm 10% / 3 Năm giảm 20%).
   - Tên miền đăng ký kèm (tặng kèm hoặc tra cứu giá).
   - Danh sách **Dịch Vụ Mua Kèm (Add-ons)** dạng checkbox:
     + [ ] Bảo vệ ẩn danh Whois (+50.000đ/năm)
     + [ ] Sao lưu tự động hằng ngày (+30.000đ/tháng)
     + [ ] IP riêng chuyên dụng (+80.000đ/tháng)
   - Ô nhập **Mã giảm giá (Coupon Code)**: Nhập `VIBE2026` bấm "Áp dụng" trừ ngay 15%.
   - Khung **Mã VietQR Ngân Hàng Động**: Tự nhảy số tiền sau khi áp mã giảm giá và cộng add-ons.
   - Nút **"Tôi Đã Chuyển Khoản Thành Công"**.
5. **Modal Hóa Đơn Điện Tử (Invoice / Receipt)**:
   - Giao diện hóa đơn chuẩn thương mại có mã `INV-2026-001`, thông tin người mua, chi tiết các khoản, giảm giá, dấu mộc tròn đỏ **"ĐÃ THANH TOÁN (PAID)"**, nút **"In Hóa Đơn"**.
6. **Section Cam Kết Vàng & Đánh Giá Khách Hàng (Social Proof)**:
   - 3 biểu tượng: Hoàn tiền 30 ngày, Uptime 99.9%, Hỗ trợ 24/7.
   - 3 thẻ đánh giá thực tế từ khách hàng uy tín.

---

## 7. Lộ trình triển khai (10 Bước Vibe Coding)

| Bước | Nhiệm vụ chính | Sản phẩm đầu ra | Thời gian |
|:---:|---|---|:---:|
| **0** | Khởi tạo cấu trúc dự án, `package.json`, `.env`, `db.json` đầy đủ 6 bảng | Nền tảng e-commerce | 25 phút |
| **1** | Viết `server.js`: Auth API, API Orders, API Coupons, VietQR | REST API hoàn chỉnh | 50 phút |
| **2** | Viết 2 API Gemini AI: Proxy tư vấn gói/domain & AI Telesale script | Proxy AI bảo mật | 30 phút |
| **3** | Xây dựng thuật toán tính điểm & công thức tính tiền giỏ hàng, add-ons, coupon | Core logic tính bill | 35 phút |
| **4** | Dựng trang `index.html`: Hero, Catalog 6 gói, Form AI, Trust Badges, Reviews | UI Mua sắm bắt mắt | 60 phút |
| **5** | Dựng Modal Đặt mua: Chu kỳ, Add-ons, Coupon code, Mã VietQR động | Luồng checkout e-commerce | 45 phút |
| **6** | Xây dựng Modal Hóa Đơn Điện Tử (Invoice) với dấu mộc PAID và nút in PDF | Tính năng hóa đơn | 35 phút |
| **7** | Dựng trang quản trị `admin.html`: Login, Dashboard OMS Doanh thu | Portal Quản trị | 40 phút |
| **8** | Bảng quản lý đơn hàng: Duyệt tiền, Phân công nhân viên, Xuất CSV, AI Telesale | OMS hoàn thiện | 55 phút |
| **9** | Kiểm thử kịch bản mua sắm toàn trình từ A đến Z | Sẵn sàng demo | 45 phút |

---

## 8. Bộ Prompt Vibe-Coding theo từng bước (Bản v3.3 E-Commerce)

### Prompt 0: Khởi tạo Project & CSDL `db.json` E-Commerce

```
Hãy tạo cho mình cấu trúc dự án "HostingAdvisor - Nền Tảng Thương Mại Điện Tử Hosting/Domain & Quản Trị Đơn Hàng":
1. package.json chứa dependencies: express, cors, dotenv, jsonwebtoken.
2. File .env mẫu:
   PORT=3000
   JWT_SECRET=vibe_secret_key_2026
   GEMINI_API_KEY=YOUR_GEMINI_API_KEY
3. File db.json gồm 6 bảng:
   - users: 1 Admin, 1 Staff, 1 Customer (hoangyen / 123456@password).
   - plans: 6 gói Hosting chuẩn.
   - domain_pricing: Bảng giá .com (280k), .vn (550k), .com.vn (450k), .shop (190k).
   - addons: 3 dịch vụ mua kèm (Whois Privacy 50k, Daily Backup 30k/tháng, Dedicated IP 80k/tháng).
   - coupons: Mã VIBE2026 (giảm 15%) và CHUSHOP (giảm 50.000đ).
   - orders: 1 đơn mẫu hoàn chỉnh ORD-2026-001 có đầy đủ add-ons, mã giảm giá và dịch vụ đã kích hoạt.
4. Cấu trúc thư mục public/ gồm: index.html, admin.html, css/style.css, js/config.js, js/plans.js, js/domains.js, js/addons.js, js/faq.js, js/app.js, js/admin.js.
5. File .gitignore.
Viết code hoàn chỉnh cho package.json và db.json ban đầu.
```

### Prompt 1: Viết Express Server.js (Auth, Coupons, Orders & VietQR)

```
Hãy viết file server.js bằng Node.js và Express, thao tác trên db.json qua fs.promises:
1. Phục vụ static file từ public/.
2. Auth API:
   - POST /api/auth/register: Đăng ký khách hàng mới.
   - POST /api/auth/login: Đăng nhập cấp JWT token mang thông tin user.
   - GET /api/auth/me: Lấy thông tin user hiện tại.
3. API Coupons:
   - POST /api/coupons/validate: Nhận {code, rawTotal}, kiểm tra mã trong db.json, tính ra discountAmount và finalTotal.
4. REST API Orders & Thanh toán VietQR:
   - POST /api/orders (Yêu cầu đăng nhập): Tính tiền chu kỳ 12/24/36 tháng, tiền tên miền, tiền Add-ons, trừ tiền Coupon. Sinh mã ORD-2026-XXX và link VietQR động.
   - POST /api/orders/:id/confirm-payment (Khách chính chủ): Báo đã chuyển khoản.
   - GET /api/orders/my-orders (Khách hàng): Xem danh sách đơn cá nhân.
   - GET /api/orders (Staff & Admin): Xem tất cả đơn hàng.
   - PATCH /api/orders/:id (Staff & Admin): Duyệt thanh toán (status = completed, cấp IP hosting demo), ghi chú và phân công nhân sự.
   - DELETE /api/orders/:id (Chỉ Admin): Xóa đơn hàng.
Viết code hoàn chỉnh, bọc try/catch cẩn thận.
```

### Prompt 2: Proxy AI Kép (Tư vấn Khách + Trợ lý Telesale Admin)

```
Trong server.js, bổ sung 2 endpoint gọi Google Gemini bằng biến môi trường process.env.GEMINI_API_KEY:
1. POST /api/advice: Nhận {systemPrompt, userMessage, planIds}, ép JSON Schema trả về {best, alternatives, domainAdvice}.
2. POST /api/advice/sales-script (Chỉ Staff/Admin): Nhận {orderId}, yêu cầu Gemini soạn kịch bản gọi điện chốt đơn 3 bước súc tích dựa trên gói, tên miền, add-ons và số tiền của đơn hàng.
Timeout 14 giây, xử lý lỗi mượt mà.
```

### Prompt 3: Logic Tính Toán Giỏ Hàng & Add-ons (Client)

```
Trong public/js/app.js, hãy cài đặt:
1. Hằng số TRAFFIC_VALUE, SITE_TYPE_LABEL, TRAFFIC_LABEL.
2. Hàm scorePlan(plan, needs) và pickTop3(plans, needs).
3. Hàm calculateCartTotal(planPriceMonthly, cycleMonths, domainExtension, isPlanFreeDomain, selectedAddons, discountAmount):
   - Tính tổng tiền hosting, tên miền, add-ons.
   - Trừ tiền giảm giá coupon.
   - Sinh link ảnh VietQR tương ứng.
4. Fallback tự động khi mất mạng hoặc không có API key.
```

### Prompt 4: Dựng Giao Diện Mua Sắm `index.html` (Catalog, Trust, Reviews)

```
Hãy viết mã nguồn hoàn chỉnh cho public/index.html bằng HTML5 và Tailwind CSS:
1. Navbar: Logo, Menu "Bảng Giá Gói", "AI Tư Vấn", "Hỏi Đáp", "Đánh Giá", Nút Auth Login/My Orders và Nút sang Cổng Quản Trị.
2. Hero & AI Buying Assistant: Form khảo sát thông minh cho khách hàng chưa biết chọn gói.
3. Section Catalog Sản Phẩm: Hiển thị toàn bộ 6 gói cước Hosting (Starter, Basic, Business, Shop Pro, VPS Growth, VPS Power) với nút "Mua Ngay" trực tiếp.
4. Section Kết Quả AI Tư Vấn (hiện khi submit form khảo sát).
5. Section Cam Kết Vàng: 3 cam kết (Hoàn tiền 30 ngày, Uptime 99.9%, Hỗ trợ 24/7).
6. Section Đánh Giá Khách Hàng: 3 review từ các chủ shop thực tế.
7. Modal Đăng Nhập / Đăng Ký Tài Khoản Khách Hàng.
8. Modal Đặt Mua & Thanh Toán E-Commerce:
   - Chọn Chu kỳ (1 năm / 2 năm / 3 năm).
   - Tên miền đăng ký.
   - Checkbox tích chọn 3 Add-on (Whois Privacy, Daily Backup, Dedicated IP).
   - Ô nhập Mã giảm giá (Coupon) kèm nút "Áp Dụng".
   - Khung hiển thị Mã VietQR động to rõ và nút "Tôi Đã Chuyển Khoản".
9. Modal Hóa Đơn Điện Tử (Invoice): Mã INV-2026-XXX, bảng kê chi tiết, mộc đỏ "ĐÃ THANH TOÁN (PAID)" và nút In hóa đơn.
10. Modal "Đơn Hàng Của Tôi": Danh sách đơn cá nhân kèm nút xem hóa đơn và thông số IP hosting.
```

### Prompt 5: Kết Nối Logic Mua Sắm `app.js`

```
Hãy viết logic trong public/js/app.js:
1. Quản lý Auth: Đăng ký, đăng nhập, lưu token, cập nhật navbar.
2. Nút "Mua Ngay" ở từng gói cước: Mở Modal Đặt Mua với gói đó được chọn sẵn.
3. Form AI Tư vấn: Gợi ý gói tối ưu và mở modal đặt mua.
4. Xử lý Coupon: Bấm "Áp Dụng" -> Gọi POST /api/coupons/validate, hiển thị số tiền được giảm và cập nhật lại mã VietQR.
5. Xử lý Tạo đơn & Chuyển khoản VietQR: Gọi POST /api/orders và POST /api/orders/:id/confirm-payment.
6. Xử lý Hóa Đơn (Invoice): Đọc thông tin đơn và render giao diện hóa đơn chuẩn hóa, hỗ trợ in bằng window.print().
```

### Prompt 6: Giao Diện Quản Trị `admin.html` (OMS Doanh Thu)

```
Hãy viết mã nguồn public/admin.html dành cho ban quản trị:
1. Màn hình Login: Nhập username/password.
2. Dashboard Quản Trị:
   - Topbar: Tên người dùng, Badge Role (ADMIN / STAFF), Đăng xuất.
   - 4 Card Thống Kê: Doanh Thu Thực Nhận, Doanh Thu Chờ Duyệt, Đơn Cần Duyệt Tiền, Tổng Đơn.
   - Bộ lọc: Tìm kiếm theo Mã đơn/SĐT/Tên miền; Lọc trạng thái; Lọc người phụ trách; Nút Xuất CSV.
   - Bảng Quản Lý Đơn Hàng: Hiển thị đầy đủ thông tin thanh toán, add-ons, coupon đã dùng, tổng tiền, trạng thái và người phụ trách.
3. Modal Chi Tiết Đơn & Duyệt Tiền:
   - Xem thông tin thanh toán VietQR.
   - Nút "Xác Nhận Đã Nhận Tiền & Kích Hoạt Dịch Vụ".
   - Khung "AI Trợ Lý Telesale": Bấm nút AI sinh kịch bản gọi điện chốt đơn.
   - Phân công nhân viên phụ trách (chỉ mở cho Admin).
   - Timeline vết đơn hàng.
```

### Prompt 7: Logic Quản Trị & AI Telesale `admin.js`

```
Hãy viết mã nguồn public/js/admin.js:
1. Kiểm tra quyền khi vào trang (chỉ cho phép Staff và Admin).
2. Tải danh sách đơn hàng từ GET /api/orders, tính 4 chỉ số KPI doanh thu, render bảng dữ liệu.
3. Duyệt thanh toán: Gửi PATCH /api/orders/:id với status = 'completed'.
4. AI Telesale: Gửi POST /api/advice/sales-script với orderId và hiển thị kịch bản 3 bước.
5. Phân công đơn (Admin) và Xóa đơn (Admin).
6. Xuất CSV chuẩn UTF-8 with BOM mở bằng Excel không lỗi font tiếng Việt.
```

### Prompt 8: Dữ Liệu Mẫu & Khuyến Mãi

```
Tạo nội dung hoàn chỉnh cho:
1. public/js/addons.js, public/js/domains.js, public/js/plans.js, public/js/faq.js, public/js/config.js.
2. db.json: Điền sẵn các coupon VIBE2026, CHUSHOP; 3 addons; 3 tài khoản (admin, staff, hoangyen); và 3 đơn hàng mẫu ở các trạng thái khác nhau để demo ngay lập tức.
```

### Prompt 9: Kịch Bản Kiểm Thử E-Commerce Toàn Trình (Demo Script)

```
Thực hiện kịch bản demo hoàn hảo từ đầu đến cuối:
1. Khách hàng truy cập index.html:
   - Xem Bảng giá tất cả gói cước, hoặc dùng AI Khảo sát nhu cầu.
   - Đăng ký/Đăng nhập tài khoản.
   - Bấm Mua Ngay gói Business 129k.
   - Chọn chu kỳ 2 năm (giảm 10%), tích chọn Add-on "Whois Privacy", nhập mã "VIBE2026" được giảm thêm 15%.
   - Màn hình hiển thị mã VietQR chính xác số tiền sau giảm giá.
   - Bấm "Tôi Đã Chuyển Khoản".
   - Mở "Đơn Hàng Của Tôi" -> Bấm "Xem Hóa Đơn" -> Thấy hóa đơn điện tử có mã INV-2026-XXX.
2. Nhân viên đăng nhập admin.html:
   - Thấy thông báo đơn mới chờ duyệt tiền.
   - Bấm "AI Soạn Kịch Bản Gọi Điện" xem kịch bản telesale.
   - Bấm "Xác Nhận Đã Nhận Tiền" -> Đơn chuyển completed, hệ thống tự cấp IP Hosting demo.
3. Khách hàng F5 lại:
   - Hóa đơn chuyển dấu mộc đỏ "ĐÃ THANH TOÁN (PAID)".
   - Thấy thông số kỹ thuật IP Hosting và DNS để trỏ website.
```

---

## 9. Hướng dẫn Khởi chạy Ứng dụng

```bash
# 1. Cài đặt thư viện
npm install

# 2. Tạo file cấu hình môi trường .env
cp .env.example .env

# 3. Điền API Key Gemini vào .env:
# GEMINI_API_KEY=AIzaSy...
# PORT=3000
# JWT_SECRET=vibe_secret_key_2026

# 4. Khởi chạy ứng dụng
npm start
```

- **Portal Mua Sắm Khách Hàng:** `http://localhost:3000/` (hoặc `http://localhost:3000/index.html`)
- **Portal Quản Trị Đơn Hàng (Admin OMS):** `http://localhost:3000/admin.html`
  - Admin: `admin` / `admin123@password`
  - Staff: `staff` / `staff123@password`
  - Khách hàng mẫu: `hoangyen` / `123456@password` (hoặc tự bấm Đăng ký tài khoản mới trên giao diện)
  - Mã giảm giá demo: `VIBE2026` (giảm 15%), `CHUSHOP` (giảm 50.000đ)
