/**
 * public/js/admin.js — BỘ KHUNG DỰ ÁN (PROJECT SKELETON / STARTER KIT)
 *
 * [ĐÃ CÓ SẴN TRONG KHUNG CỦA LEADER]:
 * - Xác thực phiên đăng nhập RBAC (Chỉ cho phép Admin & Staff truy cập Dashboard)
 * - Kết nối API lấy danh sách Nhân sự (/api/users/staff), Đơn hàng (/api/orders), Danh mục (/api/catalog)
 * - Khung Quản trị Hệ thống (Tạo/xóa Nhân sự, Coupon & Cấu hình Ngân hàng VietQR)
 *
 * [PHẦN VIỆC PHÂN CÔNG CHO THÀNH VIÊN 3 — TÌM TỪ KHÓA "TODO"]:
 * - NHIỆM VỤ 3 (Thành viên 3):
 *   1. Hoàn thiện hàm updateKPIs() tính 4 thẻ thống kê doanh thu
 *   2. Hoàn thiện hàm renderOrdersTable() & bộ lọc tìm kiếm đơn hàng
 *   3. Hoàn thiện Modal Chi tiết đơn hàng (openOrderDetailModal), Duyệt tiền cấp IP Hosting & gọi AI Telesale
 *   4. Hoàn thiện hàm exportOrdersToCSV() xuất báo cáo tài chính ra file Excel/CSV
 */

let adminToken = localStorage.getItem('ha_admin_token') || '';
let adminUser = null;
let allOrders = [];
let staffUsers = [];
let allCoupons = [];
let allReviews = [];
let bankSettings = {
  bankId: 'MB',
  accountNo: '0988123456',
  accountName: 'CONG TY TNHH HOSTING ADVISOR'
};
let activeOrder = null;

function formatVND(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '0đ';
  return num.toLocaleString('vi-VN') + 'đ';
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =========================================================
// 1. XÁC THỰC QUYỀN ADMIN / STAFF (CÓ SẴN TRONG KHUNG LEADER)
// =========================================================

function syncAdminScreenUI() {
  const loginScreen = document.getElementById('admin-login-screen');
  const dashboardScreen = document.getElementById('admin-dashboard-screen');
  const systemPanel = document.getElementById('admin-system-panel');
  const userBar = document.getElementById('admin-user-bar');
  const userNameEl = document.getElementById('admin-user-name');
  const roleBadgeEl = document.getElementById('admin-role-badge');

  if (adminUser && adminToken) {
    loginScreen?.classList.add('hidden');
    dashboardScreen?.classList.remove('hidden');
    userBar?.classList.remove('hidden');
    userBar?.classList.add('flex');
    if (adminUser.role === 'admin') {
      systemPanel?.classList.remove('hidden');
    } else {
      systemPanel?.classList.add('hidden');
    }
    if (userNameEl) userNameEl.textContent = adminUser.fullName;
    if (roleBadgeEl) roleBadgeEl.textContent = adminUser.role.toUpperCase();
  } else {
    loginScreen?.classList.remove('hidden');
    dashboardScreen?.classList.add('hidden');
    systemPanel?.classList.add('hidden');
    userBar?.classList.add('hidden');
    userBar?.classList.remove('flex');
  }
}

async function verifyAdminSession() {
  if (!adminToken) {
    syncAdminScreenUI();
    return;
  }
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!res.ok) throw new Error('Token hết hạn');
    const data = await res.json();
    if (!data.user || (data.user.role !== 'admin' && data.user.role !== 'staff')) {
      throw new Error('Không có quyền truy cập');
    }
    adminUser = data.user;
    syncAdminScreenUI();
    await loadStaffAndOrders();
  } catch (err) {
    adminToken = '';
    adminUser = null;
    localStorage.removeItem('ha_admin_token');
    syncAdminScreenUI();
  }
}

async function loadStaffAndOrders() {
  if (!adminToken) return;
  try {
    const [staffRes, ordersRes, catalogRes] = await Promise.all([
      fetch('/api/users/staff', { headers: { Authorization: `Bearer ${adminToken}` } }),
      fetch('/api/orders', { headers: { Authorization: `Bearer ${adminToken}` } }),
      fetch('/api/catalog')
    ]);
    if (staffRes.ok) {
      const sData = await staffRes.json();
      staffUsers = sData.staff || [];
    }
    if (ordersRes.ok) {
      const oData = await ordersRes.json();
      allOrders = oData.orders || [];
      updateKPIs();
      renderOrdersTable();
    }
    if (catalogRes.ok) {
      const cData = await catalogRes.json();
      if (cData.dbStatus) {
        const dbBadge = document.getElementById('db-engine-badge');
        if (dbBadge) dbBadge.textContent = `DB: ${cData.dbStatus.engine}`;
      }
      if (cData.settings) {
        bankSettings = cData.settings;
        renderBankSettingsForm();
      }
    }
  } catch (err) {
    console.error(err);
  }
}

function renderBankSettingsForm() {
  const bankIdInput = document.getElementById('setting-bank-id');
  const accNoInput = document.getElementById('setting-account-no');
  const accNameInput = document.getElementById('setting-account-name');
  const qrPreviewImg = document.getElementById('admin-bank-qr-preview');
  const bId = bankSettings.bankId || 'MB';
  const aNo = bankSettings.accountNo || '0988123456';
  const aName = bankSettings.accountName || 'CONG TY TNHH HOSTING ADVISOR';
  if (bankIdInput) bankIdInput.value = bId;
  if (accNoInput) accNoInput.value = aNo;
  if (accNameInput) accNameInput.value = aName;
  if (qrPreviewImg) {
    qrPreviewImg.src = `https://img.vietqr.io/image/${encodeURIComponent(bId)}-${encodeURIComponent(aNo)}-compact2.png?amount=10000&addInfo=TEST&accountName=${encodeURIComponent(aName)}`;
  }
}

// =========================================================
// NHIỆM VỤ 3 (THÀNH VIÊN 3): KPI DOANH THU, BẢNG ĐƠN HÀNG, DUYỆT TIỀN & XUẤT CSV
// =========================================================

function updateKPIs() {
  // TODO [ADMIN PORTAL - THÀNH VIÊN 2]:
  // Duyệt qua mảng allOrders để tính toán 4 chỉ số hiển thị lên Dashboard:
  // 1. #kpi-paid-revenue: Tổng tiền các đơn đã thanh toán (status === 'completed' || paymentStatus === 'paid')
  // 2. #kpi-pending-revenue: Tổng tiền các đơn đang chờ duyệt
  // 3. #kpi-pending-count: Số lượng đơn cần duyệt tiền
  // 4. #kpi-total-orders: Tổng số đơn hàng trên hệ thống
  document.getElementById('kpi-total-orders').textContent = String(allOrders.length);
}

function renderOrdersTable() {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;

  // TODO [ADMIN PORTAL - THÀNH VIÊN 2]:
  // 1. Lọc mảng allOrders theo ô tìm kiếm (#filter-search), trạng thái (#filter-status) và nhân sự (#filter-assignee)
  // 2. Render từng dòng đơn hàng gồm: Mã đơn, Khách hàng, Gói & Tên miền, Add-ons & Coupon, Tổng tiền, Trạng thái, Phụ trách và nút "Chi tiết & Duyệt"
  tbody.innerHTML = `
    <tr>
      <td colspan="8" class="p-8 text-center text-xs text-slate-500">
        [TODO - Nhiệm vụ 3]: Hoàn thiện hàm updateKPIs() và renderOrdersTable() trong public/js/admin.js (Hiện có ${allOrders.length} đơn hàng trên hệ thống).
      </td>
    </tr>
  `;
}

function openOrderDetailModal(orderId) {
  // TODO [ADMIN PORTAL - THÀNH VIÊN 2]:
  // Mở modal #order-detail-modal, hiển thị thông tin đơn hàng, Timeline vết xử lý,
  // nút "Xác Nhận Đã Nhận Tiền & Kích Hoạt Dịch Vụ" (gọi PATCH /api/orders/:id)
  // và nút "AI Soạn Kịch Bản Gọi Điện" (gọi POST /api/advice/sales-script).
}

function exportOrdersToCSV() {
  // TODO [ADMIN PORTAL - THÀNH VIÊN 2]:
  // Xuất danh sách đơn hàng ra file CSV có mã BOM UTF-8 ('\uFEFF') để mở bằng Microsoft Excel không bị lỗi font tiếng Việt.
  alert('[TODO - Nhiệm vụ 3]: Hãy hoàn thiện hàm exportOrdersToCSV() trong public/js/admin.js');
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('admin-login-form');
  const loginError = document.getElementById('admin-login-error');
  const logoutBtn = document.getElementById('btn-admin-logout');
  const refreshBtn = document.getElementById('btn-admin-refresh');
  const exportBtn = document.getElementById('btn-export-csv');

  verifyAdminSession();

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError?.classList.add('hidden');
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      if (loginError) {
        loginError.textContent = data.error || 'Sai thông tin đăng nhập';
        loginError.classList.remove('hidden');
      }
      return;
    }
    adminToken = data.token;
    adminUser = data.user;
    localStorage.setItem('ha_admin_token', adminToken);
    syncAdminScreenUI();
    await loadStaffAndOrders();
  });

  logoutBtn?.addEventListener('click', () => {
    adminToken = '';
    adminUser = null;
    localStorage.removeItem('ha_admin_token');
    syncAdminScreenUI();
  });

  refreshBtn?.addEventListener('click', () => loadStaffAndOrders());
  exportBtn?.addEventListener('click', exportOrdersToCSV);
});

