/**
 * public/js/plans.js
 * Danh mục 6 gói Hosting & VPS chuẩn của hệ thống
 */

window.PLANS_DATA = [
  {
    id: 'starter',
    name: 'Starter',
    type: 'Shared Hosting',
    pricePerMonth: 39000,
    storage: '5 GB SSD',
    bandwidth: '50 GB/tháng',
    recommendedVisits: 3000,
    freeDomain: false,
    features: ['1 website', 'SSL miễn phí', '1 email doanh nghiệp'],
    bestFor: 'Blog cá nhân, trang giới thiệu nhỏ'
  },
  {
    id: 'basic',
    name: 'Basic',
    type: 'Shared Hosting',
    pricePerMonth: 69000,
    storage: '20 GB SSD',
    bandwidth: '200 GB/tháng',
    recommendedVisits: 10000,
    freeDomain: true,
    features: ['3 website', 'SSL miễn phí', 'Tặng tên miền .com/.vn năm đầu', '5 email doanh nghiệp'],
    bestFor: 'Trang giới thiệu doanh nghiệp, shop nhỏ mới bắt đầu'
  },
  {
    id: 'business',
    name: 'Business',
    type: 'Shared Hosting',
    pricePerMonth: 129000,
    storage: '50 GB NVMe',
    bandwidth: 'Không giới hạn',
    recommendedVisits: 30000,
    freeDomain: true,
    features: ['10 website', 'SSL miễn phí', 'Tặng tên miền năm đầu', 'Sao lưu hằng tuần', 'Tăng tốc LiteSpeed'],
    bestFor: 'Shop online vừa, nhiều ảnh sản phẩm'
  },
  {
    id: 'shop-pro',
    name: 'Shop Pro',
    type: 'Cloud Hosting',
    pricePerMonth: 249000,
    storage: '100 GB NVMe',
    bandwidth: 'Không giới hạn',
    recommendedVisits: 80000,
    freeDomain: true,
    features: ['Tối ưu WooCommerce', 'Sao lưu hằng ngày', 'CDN miễn phí', 'Tặng tên miền năm đầu', 'Hỗ trợ ưu tiên'],
    bestFor: 'Shop bán hàng đông khách, có chạy quảng cáo'
  },
  {
    id: 'vps-1',
    name: 'VPS Growth',
    type: 'VPS',
    pricePerMonth: 399000,
    storage: '80 GB NVMe',
    bandwidth: '1 TB/tháng',
    recommendedVisits: 150000,
    freeDomain: false,
    features: ['2 CPU, 4 GB RAM', 'Toàn quyền quản trị', 'Sao lưu hằng ngày', 'Tự cài phần mềm theo ý'],
    bestFor: 'Website lượng truy cập cao, cần tuỳ biến sâu'
  },
  {
    id: 'vps-2',
    name: 'VPS Power',
    type: 'VPS',
    pricePerMonth: 799000,
    storage: '160 GB NVMe',
    bandwidth: '3 TB/tháng',
    recommendedVisits: 500000,
    freeDomain: false,
    features: ['4 CPU, 8 GB RAM', 'Toàn quyền quản trị', 'Sao lưu hằng ngày', 'IP riêng'],
    bestFor: 'Báo điện tử, sàn thương mại, lượng truy cập lớn'
  }
];
