-- ============================================================================
-- SUPABASE POSTGRESQL SCHEMA CHO HỆ THỐNG HOSTINGADVISOR OMS (v3.3 E-COMMERCE)
-- Hướng dẫn: Copy toàn bộ nội dung file này dán vào mục "SQL Editor" trên
-- trang quản trị Supabase (https://supabase.com/dashboard) và bấm nút "RUN".
-- ============================================================================

-- 1. BẢNG CẤU HÌNH HỆ THỐNG & NGÂN HÀNG VIETQR (settings)
CREATE TABLE IF NOT EXISTS public.settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  bank_id TEXT NOT NULL DEFAULT 'MB',
  account_no TEXT NOT NULL DEFAULT '0988123456',
  account_name TEXT NOT NULL DEFAULT 'CONG TY TNHH HOSTING ADVISOR',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BẢNG NGƯỜI DÙNG & PHÂN QUYỀN RBAC (users)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'staff', 'customer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BẢNG MÃ GIẢM GIÁ KHUYẾN MÃI (coupons)
CREATE TABLE IF NOT EXISTS public.coupons (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
  value NUMERIC NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BẢNG DANH MỤC GÓI CƯỚC HOSTING & CLOUD VPS (plans)
CREATE TABLE IF NOT EXISTS public.plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price_monthly NUMERIC NOT NULL,
  cpu TEXT NOT NULL,
  ram TEXT NOT NULL,
  storage TEXT NOT NULL,
  bandwidth TEXT NOT NULL,
  domains TEXT NOT NULL,
  ssl_free BOOLEAN DEFAULT TRUE,
  backup TEXT NOT NULL,
  support TEXT NOT NULL,
  highlight BOOLEAN DEFAULT FALSE,
  best_for TEXT DEFAULT '',
  specs_summary TEXT DEFAULT '',
  target_audience JSONB DEFAULT '[]'::jsonb
);

-- 5. BẢNG GIÁ TÊN MIỀN ĐÍNH KÈM (domain_pricing)
CREATE TABLE IF NOT EXISTS public.domain_pricing (
  tld TEXT PRIMARY KEY,
  reg_price NUMERIC NOT NULL,
  renew_price NUMERIC NOT NULL,
  badge TEXT DEFAULT ''
);

-- 6. BẢNG DỊCH VỤ CỘNG THÊM MUA KÈM (addons)
CREATE TABLE IF NOT EXISTS public.addons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  billing TEXT NOT NULL,
  description TEXT DEFAULT ''
);

-- 7. BẢNG ĐƠN HÀNG THƯƠNG MẠI ĐIỆN TỬ & OMS (orders)
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  billing_cycle_months INTEGER NOT NULL DEFAULT 12,
  domain_name TEXT DEFAULT '',
  domain_years INTEGER DEFAULT 0,
  addons JSONB DEFAULT '[]'::jsonb,
  coupon_applied TEXT,
  hosting_amount NUMERIC NOT NULL DEFAULT 0,
  domain_amount NUMERIC NOT NULL DEFAULT 0,
  addons_amount NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'vietqr',
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid_processing', 'completed', 'cancelled')),
  qr_url TEXT DEFAULT '',
  service_details JSONB,
  assigned_to TEXT,
  assigned_to_name TEXT DEFAULT 'Chưa phân công',
  notes TEXT DEFAULT '',
  timeline JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. BẢNG ĐÁNH GIÁ THỰC TẾ CỦA KHÁCH HÀNG (reviews)
CREATE TABLE IF NOT EXISTS public.reviews (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  business_name TEXT DEFAULT '',
  plan_name TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tắt RLS và cấp quyền truy cập đầy đủ cho cả Publishable Key (anon) và Secret Key (service_role)
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_pricing DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.addons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.users TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.coupons TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.plans TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.domain_pricing TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.addons TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.orders TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.reviews TO anon, authenticated, service_role;

-- ============================================================================
-- KHỞI TẠO DỮ LIỆU GỐC (SEED DATA)
-- ============================================================================

INSERT INTO public.settings (id, bank_id, account_no, account_name)
VALUES (1, 'MB', '0988123456', 'CONG TY TNHH HOSTING ADVISOR')
ON CONFLICT (id) DO NOTHING;

-- Tài khoản Root Admin mặc định: username = admin / password = admin123@password
INSERT INTO public.users (id, username, password_hash, full_name, phone, email, role)
VALUES (
  'USR-ADMIN-01',
  'admin',
  'admin123@password',
  'Quản Trị Viên Hệ Thống',
  '0901000111',
  'admin@hostingadvisor.vn',
  'admin'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.coupons (code, type, value, description)
VALUES
  ('VIBE2026', 'percent', 15, 'Giảm 15% tổng giá trị đơn hàng'),
  ('CHUSHOP', 'fixed', 200000, 'Giảm trực tiếp 200.000đ vào hóa đơn')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.domain_pricing (tld, reg_price, renew_price, badge)
VALUES
  ('.com', 299000, 350000, 'Phổ biến toàn cầu'),
  ('.vn', 650000, 480000, 'Thương hiệu Quốc gia VN'),
  ('.net', 320000, 370000, 'Công nghệ & Hạ tầng'),
  ('.com.vn', 550000, 380000, 'Doanh nghiệp Việt Nam')
ON CONFLICT (tld) DO NOTHING;

INSERT INTO public.addons (id, name, price, billing, description)
VALUES
  ('addon-whois', 'Bảo mật thông tin tên miền (Whois Privacy)', 99000, '1 lần / năm đầu', 'Ẩn thông tin cá nhân chủ sở hữu tên miền trên hệ thống tra cứu WHOIS quốc tế.'),
  ('addon-backup', 'Sao lưu dữ liệu tự động hàng ngày (Daily Pro Backup)', 240000, 'Trọn gói 12 tháng', 'Tự động sao lưu mã nguồn và Database mỗi 24 giờ sang cụm máy chủ lưu trữ độc lập.'),
  ('addon-dedi-ip', 'Địa chỉ IP tĩnh riêng biệt (Dedicated IPv4)', 600000, 'Trọn gói 12 tháng', 'Tăng độ uy tín SEO, hỗ trợ cấu hình SSL nâng cao và tránh bị ảnh hưởng bởi website khác.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.plans (id, name, category, price_monthly, cpu, ram, storage, bandwidth, domains, ssl_free, backup, support, highlight, best_for, specs_summary, target_audience)
VALUES
  ('starter', 'Starter', 'Shared Hosting', 59000, '1 vCPU', '1 GB', '10 GB NVMe', 'Không giới hạn', '1 website', true, 'Hàng tuần', 'Hỗ trợ 24/7 qua Ticket', false, 'Sinh viên, blog cá nhân, landing page cơ bản', '1 vCPU • 1GB RAM • 10GB NVMe', '["Blog cá nhân, CV / Portfolio trực tuyến", "Sinh viên thực hành học lập trình web", "Landing page giới thiệu sự kiện ngắn hạn"]'::jsonb),
  ('wordpress-plus', 'WordPress Plus', 'WordPress Hosting', 119000, '2 vCPU', '2 GB', '25 GB NVMe', 'Không giới hạn', '3 website', true, 'Hàng ngày', 'Hỗ trợ 24/7 + Tối ưu WP', false, 'Website tin tức, blog chuyên nghiệp, web giới thiệu công ty', '2 vCPU • 2GB RAM • 25GB NVMe', '["Website giới thiệu doanh nghiệp vừa và nhỏ", "Trang tin tức, tạp chí điện tử dùng WordPress", "Shop bán hàng nhỏ mới khởi nghiệp"]'::jsonb),
  ('pro', 'Pro Business', 'Business Hosting', 199000, '3 vCPU', '4 GB', '50 GB NVMe', 'Không giới hạn', '10 website', true, 'Hàng ngày (Lưu 14 bản)', 'Ưu tiên 24/7 + Livechat', true, 'Shop bán hàng WooCommerce, web doanh nghiệp vừa & nhỏ', '3 vCPU • 4GB RAM • 50GB NVMe', '["Cửa hàng Thương mại điện tử / WooCommerce", "Doanh nghiệp cần độ ổn định & tốc độ phản hồi cao", "Chạy nhiều chiến dịch quảng cáo Facebook / Google Ads"]'::jsonb),
  ('ecommerce-max', 'E-Commerce Max', 'Business Hosting', 329000, '4 vCPU', '6 GB', '80 GB NVMe', 'Không giới hạn', '25 website', true, 'Hàng ngày (Lưu 30 bản)', 'Chuyên gia 1-1 24/7', false, 'Sàn TMĐT vừa, chuỗi cửa hàng có lượng truy cập cao', '4 vCPU • 6GB RAM • 80GB NVMe', '["Hệ thống bán hàng đa kênh có hàng nghìn sản phẩm", "Website chạy Flash Sale, khuyến mãi giờ vàng", "Cổng thông tin khách hàng / CRM nội bộ"]'::jsonb),
  ('vps-cloud-1', 'Cloud VPS Basic', 'Cloud VPS', 450000, '4 vCPU Dedicated', '8 GB DDR4', '120 GB NVMe RAID-10', '10 Gbps Unmetered', 'Không giới hạn (Root Access)', true, 'Snapshot tự động hàng ngày', 'Kỹ sư hệ thống hỗ trợ 24/7', false, 'Hệ thống Web App Node.js/Python/Laravel, CRM, ERP', '4 Core Dedicated • 8GB RAM • 120GB NVMe', '["Ứng dụng Web tự code (Node.js, Laravel, Python, Go)", "Doanh nghiệp cần toàn quyền quản trị Root / Docker", "Hệ thống API Backend cho ứng dụng di động"]'::jsonb),
  ('vps-cloud-2', 'Cloud VPS Enterprise', 'Cloud VPS', 890000, '8 vCPU Dedicated', '16 GB DDR4', '250 GB NVMe RAID-10', '10 Gbps Unmetered', 'Không giới hạn (Root Access)', true, 'Snapshot + Offsite Backup', 'Kỹ sư trưởng trực chiến 24/7', false, 'Hệ thống lớn >20.000 lượt/ngày, портал tập đoàn, SaaS', '8 Core Dedicated • 16GB RAM • 250GB NVMe', '["Sàn thương mại điện tử lớn, hệ thống SaaS đa người dùng", "Website có trên 20.000 - 100.000 lượt truy cập mỗi ngày", "Cần IP tĩnh độc lập và tường lửa chống DDoS chuyên sâu"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

