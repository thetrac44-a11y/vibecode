/**
 * public/js/admin.js
 * Logic Quản trị Đơn hàng (OMS), Phân quyền RBAC (Admin/Staff), Duyệt tiền VietQR, AI Telesale & Xuất CSV
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

function getStatusBadgeHtml(order) {
  if (order.status === 'completed' || order.paymentStatus === 'paid') {
    return '<span class="inline-block text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">Đã kích hoạt (Paid)</span>';
  }
  if (order.status === 'paid_processing') {
    return '<span class="inline-block text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full">Chờ duyệt tiền (Đã CK)</span>';
  }
  if (order.status === 'cancelled') {
    return '<span class="inline-block text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">Đã hủy</span>';
  }
  return '<span class="inline-block text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-full">Chờ thanh toán</span>';
}

// =========================================================
// 1. XÁC THỰC QUYỀN ADMIN / STAFF & KHỞI TẠO DASHBOARD
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
    if (roleBadgeEl) {
      roleBadgeEl.textContent = adminUser.role.toUpperCase();
      roleBadgeEl.className =
        adminUser.role === 'admin'
          ? 'text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-900'
          : 'text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-brand-500 text-white';
    }
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
    if (!res.ok) {
      throw new Error('Token hết hạn');
    }
    const data = await res.json();
    if (!data.user || (data.user.role !== 'admin' && data.user.role !== 'staff')) {
      throw new Error('Không có quyền truy cập trang quản trị');
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
    const requests = [
      fetch('/api/users/staff', { headers: { Authorization: `Bearer ${adminToken}` } }),
      fetch('/api/orders', { headers: { Authorization: `Bearer ${adminToken}` } }),
      fetch('/api/catalog')
    ];

    if (adminUser?.role === 'admin') {
      requests.push(fetch('/api/admin/coupons', { headers: { Authorization: `Bearer ${adminToken}` } }));
    }

    const [staffRes, ordersRes, catalogRes, couponsRes] = await Promise.all(requests);

    if (staffRes.ok) {
      const sData = await staffRes.json();
      staffUsers = Array.isArray(sData.staff) ? sData.staff : [];
      populateStaffDropdowns();
      renderStaffManagementList();
    }

    if (ordersRes.ok) {
      const oData = await ordersRes.json();
      allOrders = Array.isArray(oData.orders) ? oData.orders : [];
      updateKPIs();
      renderOrdersTable();
    }

    if (catalogRes && catalogRes.ok) {
      const cData = await catalogRes.json();
      if (cData.dbStatus) {
        const dbBadge = document.getElementById('db-engine-badge');
        if (dbBadge) {
          dbBadge.textContent = `DB: ${cData.dbStatus.engine}`;
          dbBadge.title = cData.dbStatus.message || '';
          dbBadge.className = cData.dbStatus.isCloudSql
            ? 'hidden sm:inline-block ml-2 text-xs font-bold bg-emerald-900/80 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-700'
            : 'hidden sm:inline-block ml-2 text-xs font-semibold bg-slate-800 text-amber-300 px-2.5 py-0.5 rounded-full border border-slate-700';
        }
      }
      if (cData.settings) {
        bankSettings = cData.settings;
        if (window.APP_CONFIG) {
          window.APP_CONFIG.BANK_ID = bankSettings.bankId || 'MB';
          window.APP_CONFIG.ACCOUNT_NO = bankSettings.accountNo || '0988123456';
          window.APP_CONFIG.ACCOUNT_NAME = bankSettings.accountName || 'CONG TY TNHH HOSTING ADVISOR';
        }
        renderBankSettingsForm();
      }
      if (Array.isArray(cData.reviews)) {
        allReviews = cData.reviews;
        renderReviewsManagementList();
      }
    }

    if (couponsRes && couponsRes.ok) {
      const cpData = await couponsRes.json();
      allCoupons = Array.isArray(cpData.coupons) ? cpData.coupons : [];
      renderCouponsManagementList();
    }
  } catch (err) {
    console.error('Lỗi tải dữ liệu OMS:', err);
  }
}

function renderStaffManagementList() {
  const container = document.getElementById('staff-list-container');
  if (!container) return;

  if (staffUsers.length === 0) {
    container.innerHTML = '<div class="text-slate-400">Chưa có nhân sự nào.</div>';
    return;
  }

  container.innerHTML = staffUsers
    .map((u) => {
      const isSelf = adminUser && u.id === adminUser.id;
      return `
        <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <div class="font-bold text-slate-900">${escapeHtml(u.fullName)} <span class="text-brand-700 font-mono">(@${escapeHtml(u.username)})</span></div>
            <div class="text-slate-500">Quyền: <strong>${escapeHtml(u.role.toUpperCase())}</strong> ${u.phone ? `— ${escapeHtml(u.phone)}` : ''}</div>
          </div>
          ${
            !isSelf
              ? `
                <button
                  type="button"
                  data-delete-staff-id="${escapeHtml(u.id)}"
                  class="btn-delete-staff py-1 px-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-semibold transition-colors"
                >
                  Xóa
                </button>
              `
              : '<span class="text-slate-400 font-semibold">Đang dùng</span>'
          }
        </div>
      `;
    })
    .join('');
}

function renderCouponsManagementList() {
  const container = document.getElementById('coupon-list-container');
  if (!container) return;

  if (allCoupons.length === 0) {
    container.innerHTML = '<div class="text-slate-400">Chưa có mã giảm giá nào.</div>';
    return;
  }

  container.innerHTML = allCoupons
    .map((c) => {
      const valText = c.type === 'percent' ? `Giảm ${c.value}%` : `Giảm ${formatVND(c.value)}`;
      return `
        <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <div class="font-mono font-bold text-emerald-700">${escapeHtml(c.code)} — <span class="font-sans text-slate-900">${escapeHtml(valText)}</span></div>
            <div class="text-slate-500">${escapeHtml(c.description || '')}</div>
          </div>
          <button
            type="button"
            data-delete-coupon-code="${escapeHtml(c.code)}"
            class="btn-delete-coupon py-1 px-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-semibold transition-colors"
          >
            Xóa
          </button>
        </div>
      `;
    })
    .join('');
}

function renderBankSettingsForm() {
  const bankIdInput = document.getElementById('setting-bank-id');
  const accNoInput = document.getElementById('setting-account-no');
  const accNameInput = document.getElementById('setting-account-name');
  const qrPreviewImg = document.getElementById('admin-bank-qr-preview');
  const qrCaption = document.getElementById('admin-bank-qr-caption');

  const bId = bankSettings.bankId || 'MB';
  const aNo = bankSettings.accountNo || '0988123456';
  const aName = bankSettings.accountName || 'CONG TY TNHH HOSTING ADVISOR';

  if (bankIdInput) bankIdInput.value = bId;
  if (accNoInput) accNoInput.value = aNo;
  if (accNameInput) accNameInput.value = aName;

  if (qrPreviewImg) {
    qrPreviewImg.src = `https://img.vietqr.io/image/${encodeURIComponent(bId)}-${encodeURIComponent(aNo)}-compact2.png?amount=10000&addInfo=${encodeURIComponent('TEST VIETQR')}&accountName=${encodeURIComponent(aName)}`;
  }
  if (qrCaption) {
    qrCaption.textContent = `${bId} • ${aNo} • ${aName}`;
  }
}

function renderReviewsManagementList() {
  const container = document.getElementById('admin-reviews-list');
  if (!container) return;

  if (!Array.isArray(allReviews) || allReviews.length === 0) {
    container.innerHTML =
      '<div class="md:col-span-3 text-slate-400 p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">Chưa có đánh giá nào từ khách hàng.</div>';
    return;
  }

  container.innerHTML = allReviews
    .map(
      (r) => `
        <div class="flex flex-col justify-between gap-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-amber-700">${Number(r.rating) || 5}/5 — ${escapeHtml(r.planName)}</span>
              <button
                type="button"
                data-delete-review-id="${escapeHtml(r.id)}"
                class="btn-delete-review py-1 px-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-semibold transition-colors"
              >
                Xóa
              </button>
            </div>
            <p class="text-slate-700 italic mt-1.5">"${escapeHtml(r.comment)}"</p>
          </div>
          <div class="pt-2 border-t border-slate-200/80 text-slate-500">
            <strong class="text-slate-900">${escapeHtml(r.customerName)}</strong> ${r.businessName ? `(${escapeHtml(r.businessName)})` : ''}
          </div>
        </div>
      `
    )
    .join('');
}

function populateStaffDropdowns() {
  const filterAssignee = document.getElementById('filter-assignee');
  const detailAssignee = document.getElementById('detail-assignee-select');

  if (filterAssignee) {
    const currentVal = filterAssignee.value || 'all';
    filterAssignee.innerHTML = `
      <option value="all">Tất cả người phụ trách</option>
      <option value="unassigned">Chưa phân công</option>
      ${staffUsers.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.fullName)} (${escapeHtml(s.role)})</option>`).join('')}
    `;
    filterAssignee.value = currentVal;
  }

  if (detailAssignee) {
    detailAssignee.innerHTML = `
      <option value="">Chưa phân công</option>
      ${staffUsers.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.fullName)} (${escapeHtml(s.role)})</option>`).join('')}
    `;
  }
}

// =========================================================
// 2. TÍNH TOÁN 4 CHỈ SỐ KPI DOANH THU & LỌC BẢNG ĐƠN HÀNG
// =========================================================

function updateKPIs() {
  let paidRevenue = 0;
  let pendingRevenue = 0;
  let pendingCount = 0;

  for (const o of allOrders) {
    const amt = Number(o.totalAmount) || 0;
    if (o.status === 'completed' || o.paymentStatus === 'paid') {
      paidRevenue += amt;
    } else if (o.status === 'paid_processing' || o.status === 'pending_payment') {
      pendingRevenue += amt;
      pendingCount += 1;
    }
  }

  document.getElementById('kpi-paid-revenue').textContent = formatVND(paidRevenue);
  document.getElementById('kpi-pending-revenue').textContent = formatVND(pendingRevenue);
  document.getElementById('kpi-pending-count').textContent = String(pendingCount);
  document.getElementById('kpi-total-orders').textContent = String(allOrders.length);
}

function getFilteredOrders() {
  const searchVal = (document.getElementById('filter-search')?.value || '').trim().toLowerCase();
  const statusVal = document.getElementById('filter-status')?.value || 'all';
  const assigneeVal = document.getElementById('filter-assignee')?.value || 'all';

  return allOrders.filter((o) => {
    if (statusVal !== 'all' && o.status !== statusVal) return false;
    if (assigneeVal === 'unassigned' && o.assignedTo) return false;
    if (assigneeVal !== 'all' && assigneeVal !== 'unassigned' && o.assignedTo !== assigneeVal) return false;

    if (searchVal) {
      const haystack = [
        o.id,
        o.customerName,
        o.phone,
        o.email,
        o.domainName,
        o.planName,
        o.couponApplied
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(searchVal)) return false;
    }
    return true;
  });
}

function renderOrdersTable() {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;

  const filtered = getFilteredOrders();
  const isAdmin = adminUser?.role === 'admin';

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-sm text-slate-500">
          Không tìm thấy đơn hàng nào khớp với bộ lọc hiện tại.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map((o) => {
      const addonsStr =
        Array.isArray(o.addons) && o.addons.length > 0
          ? o.addons.map((a) => a.name).join(', ')
          : 'Không có';
      const couponStr = o.couponApplied
        ? `${o.couponApplied} (-${formatVND(o.discountAmount)})`
        : 'Không áp mã';

      return `
        <tr class="hover:bg-slate-50/90 transition-colors">
          <td class="p-3.5 align-top">
            <div class="font-mono font-bold text-brand-700">${escapeHtml(o.id)}</div>
            <div class="text-xs text-slate-500 mt-0.5">${new Date(o.createdAt).toLocaleString('vi-VN')}</div>
          </td>
          <td class="p-3.5 align-top">
            <div class="font-semibold text-slate-900">${escapeHtml(o.customerName)}</div>
            <div class="font-mono text-xs text-slate-600">${escapeHtml(o.phone)}</div>
          </td>
          <td class="p-3.5 align-top">
            <div class="font-bold text-slate-900">Gói ${escapeHtml(o.planName)} (${o.billingCycleMonths}T)</div>
            <div class="text-xs text-brand-700 font-medium">${escapeHtml(o.domainName || 'Không kèm tên miền')}</div>
          </td>
          <td class="p-3.5 align-top text-xs">
            <div class="text-slate-700 max-w-[200px] truncate" title="${escapeHtml(addonsStr)}">Add-ons: ${escapeHtml(addonsStr)}</div>
            <div class="text-emerald-700 font-medium mt-0.5">Coupon: ${escapeHtml(couponStr)}</div>
          </td>
          <td class="p-3.5 align-top font-extrabold text-slate-900 whitespace-nowrap">
            ${formatVND(o.totalAmount)}
          </td>
          <td class="p-3.5 align-top whitespace-nowrap">
            ${getStatusBadgeHtml(o)}
          </td>
          <td class="p-3.5 align-top text-xs text-slate-700 whitespace-nowrap">
            ${escapeHtml(o.assignedToName || 'Chưa phân công')}
          </td>
          <td class="p-3.5 align-top text-right whitespace-nowrap space-x-1.5">
            <button
              type="button"
              data-detail-order-id="${escapeHtml(o.id)}"
              class="btn-open-detail py-1.5 px-3 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors"
            >
              Chi tiết &amp; Duyệt
            </button>
            ${
              isAdmin
                ? `
                  <button
                    type="button"
                    data-delete-order-id="${escapeHtml(o.id)}"
                    class="btn-delete-order py-1.5 px-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition-colors"
                  >
                    Xóa
                  </button>
                `
                : ''
            }
          </td>
        </tr>
      `;
    })
    .join('');
}

// =========================================================
// 3. MODAL CHI TIẾT ĐƠN, DUYỆT TIỀN VIETQR & AI TELESALE
// =========================================================

function openOrderDetailModal(orderId) {
  const order = allOrders.find((o) => o.id === orderId);
  if (!order) return;
  activeOrder = order;

  const modal = document.getElementById('order-detail-modal');
  document.getElementById('detail-order-id').textContent = order.id;

  const addonsText =
    Array.isArray(order.addons) && order.addons.length > 0
      ? order.addons.map((a) => `${a.name} (${formatVND(a.price)})`).join(', ')
      : 'Không đăng ký thêm';

  document.getElementById('detail-summary-box').innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div><strong>Khách hàng:</strong> ${escapeHtml(order.customerName)} (${escapeHtml(order.phone)})</div>
      <div><strong>Email:</strong> ${escapeHtml(order.email || 'Chưa cập nhật')}</div>
      <div><strong>Gói Hosting:</strong> ${escapeHtml(order.planName)} (${order.billingCycleMonths} tháng)</div>
      <div><strong>Tên miền:</strong> ${escapeHtml(order.domainName || 'Không có')}</div>
      <div class="sm:col-span-2"><strong>Add-ons:</strong> ${escapeHtml(addonsText)}</div>
      <div><strong>Mã giảm giá:</strong> ${escapeHtml(order.couponApplied || 'Không')} (-${formatVND(order.discountAmount || 0)})</div>
      <div><strong>Tổng thanh toán:</strong> <span class="font-extrabold text-brand-700">${formatVND(order.totalAmount)}</span></div>
    </div>
    ${
      order.serviceDetails
        ? `
          <div class="mt-2 pt-2 border-t border-slate-200 text-emerald-800 font-semibold">
            Đã cấp IP Hosting: <code class="font-mono">${escapeHtml(order.serviceDetails.hostingIp)}</code> |
            DNS: <code class="font-mono">${escapeHtml((order.serviceDetails.nameServers || []).join(', '))}</code>
          </div>
        `
        : ''
    }
  `;

  const approveBtn = document.getElementById('btn-approve-payment');
  const paymentText = document.getElementById('detail-payment-status-text');
  if (order.status === 'completed' || order.paymentStatus === 'paid') {
    paymentText.textContent = 'Đơn hàng này đã được xác nhận thanh toán đủ và kích hoạt IP Hosting.';
    approveBtn.classList.add('hidden');
  } else {
    paymentText.textContent = `Cần thu: ${formatVND(order.totalAmount)} — Bấm nút bên cạnh để xác nhận đã nhận tiền VietQR và cấp IP Hosting.`;
    approveBtn.classList.remove('hidden');
  }

  const statusSelect = document.getElementById('detail-status-select');
  const assigneeSelect = document.getElementById('detail-assignee-select');
  const notesInput = document.getElementById('detail-notes-input');

  statusSelect.value = order.status || 'pending_payment';
  assigneeSelect.value = order.assignedTo || '';
  assigneeSelect.disabled = adminUser?.role !== 'admin';
  notesInput.value = order.notes || '';
  document.getElementById('detail-save-msg')?.classList.add('hidden');

  // Render Timeline
  const timelineList = document.getElementById('detail-timeline-list');
  const timeline = Array.isArray(order.timeline) ? order.timeline : [];
  timelineList.innerHTML = timeline
    .slice()
    .reverse()
    .map(
      (t) => `
        <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div class="font-semibold text-slate-800">${escapeHtml(t.action)}</div>
          <div class="text-slate-500 mt-0.5">Thực hiện bởi: <strong>${escapeHtml(t.by)}</strong> — ${new Date(t.time).toLocaleString('vi-VN')}</div>
        </div>
      `
    )
    .join('');

  // QR đối soát
  const bankId = window.APP_CONFIG?.BANK_ID || 'MB';
  const accountNo = window.APP_CONFIG?.ACCOUNT_NO || '0988123456';
  const accountName = window.APP_CONFIG?.ACCOUNT_NAME || 'HOSTING ADVISOR CORP';
  const qrUrl =
    order.qrUrl ||
    `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${order.totalAmount}&addInfo=${encodeURIComponent(order.id)}&accountName=${encodeURIComponent(accountName)}`;

  document.getElementById('detail-qr-img').src = qrUrl;
  document.getElementById('detail-qr-amount').textContent = `${order.id} — ${formatVND(order.totalAmount)}`;
  document.getElementById('detail-sales-script-box').textContent =
    'Bấm nút "AI Soạn Kịch Bản Gọi Điện" ở trên để tạo kịch bản tư vấn 3 bước cho khách hàng này.';

  modal?.classList.remove('hidden');
}

async function patchOrder(orderId, payload) {
  const res = await fetch(`/api/orders/${orderId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Không cập nhật được đơn hàng');
  }
  await loadStaffAndOrders();
  openOrderDetailModal(orderId);
}

// =========================================================
// 4. XUẤT BÁO CÁO TÀI CHÍNH CSV (UTF-8 WITH BOM)
// =========================================================

function exportOrdersToCSV() {
  const rowsData = getFilteredOrders();
  if (rowsData.length === 0) {
    alert('Không có đơn hàng nào để xuất CSV.');
    return;
  }

  const headers = [
    'Mã Đơn',
    'Thời Gian',
    'Khách Hàng',
    'Số Điện Thoại',
    'Email',
    'Gói Hosting',
    'Chu Kỳ (Tháng)',
    'Tên Miền',
    'Add-ons',
    'Mã Giảm Giá',
    'Tiền Giảm',
    'Tổng Thanh Toán',
    'Trạng Thái Thanh Toán',
    'Trạng Thái Đơn',
    'Nhân Sự Phụ Trách'
  ];

  const rows = rowsData.map((o) => {
    const addonsStr = Array.isArray(o.addons) ? o.addons.map((a) => a.name).join(' + ') : '';
    return [
      o.id,
      o.createdAt,
      o.customerName,
      o.phone,
      o.email,
      o.planName,
      o.billingCycleMonths,
      o.domainName,
      addonsStr,
      o.couponApplied || '',
      o.discountAmount || 0,
      o.totalAmount,
      o.paymentStatus,
      o.status,
      o.assignedToName || 'Chưa phân công'
    ].map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`);
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `bao-cao-don-hang-oms-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// =========================================================
// 5. KHỞI TẠO SỰ KIỆN TRANG QUẢN TRỊ
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('admin-login-form');
  const loginError = document.getElementById('admin-login-error');
  const logoutBtn = document.getElementById('btn-admin-logout');
  const refreshBtn = document.getElementById('btn-admin-refresh');
  const exportBtn = document.getElementById('btn-export-csv');
  const tbody = document.getElementById('admin-orders-tbody');
  const closeDetailBtn = document.getElementById('btn-close-detail-modal');
  const approvePaymentBtn = document.getElementById('btn-approve-payment');
  const saveUpdateBtn = document.getElementById('btn-save-order-update');
  const generateScriptBtn = document.getElementById('btn-generate-sales-script');

  // Form Quản trị Hệ thống (Dành cho Admin)
  const createStaffForm = document.getElementById('form-create-staff');
  const staffListContainer = document.getElementById('staff-list-container');
  const createCouponForm = document.getElementById('form-create-coupon');
  const couponListContainer = document.getElementById('coupon-list-container');
  const bankSettingsForm = document.getElementById('form-bank-settings');

  verifyAdminSession();

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginError.classList.add('hidden');

    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        loginError.textContent = data.error || 'Sai thông tin đăng nhập';
        loginError.classList.remove('hidden');
        return;
      }

      if (data.user.role !== 'admin' && data.user.role !== 'staff') {
        loginError.textContent = 'Tài khoản Khách hàng không được phép đăng nhập vào Cổng Quản Trị OMS.';
        loginError.classList.remove('hidden');
        return;
      }

      adminToken = data.token;
      adminUser = data.user;
      localStorage.setItem('ha_admin_token', adminToken);
      syncAdminScreenUI();
      await loadStaffAndOrders();
    } catch (err) {
      loginError.textContent = 'Lỗi kết nối máy chủ khi đăng nhập';
      loginError.classList.remove('hidden');
    }
  });

  logoutBtn?.addEventListener('click', () => {
    adminToken = '';
    adminUser = null;
    localStorage.removeItem('ha_admin_token');
    syncAdminScreenUI();
  });

  refreshBtn?.addEventListener('click', () => loadStaffAndOrders());
  exportBtn?.addEventListener('click', exportOrdersToCSV);

  document.getElementById('filter-search')?.addEventListener('input', renderOrdersTable);
  document.getElementById('filter-status')?.addEventListener('change', renderOrdersTable);
  document.getElementById('filter-assignee')?.addEventListener('change', renderOrdersTable);

  tbody?.addEventListener('click', async (event) => {
    const detailBtn = event.target.closest('.btn-open-detail');
    if (detailBtn) {
      openOrderDetailModal(detailBtn.getAttribute('data-detail-order-id'));
      return;
    }

    const delBtn = event.target.closest('.btn-delete-order');
    if (delBtn) {
      const id = delBtn.getAttribute('data-delete-order-id');
      if (!id) return;
      try {
        const res = await fetch(`/api/orders/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        if (res.ok) {
          await loadStaffAndOrders();
        }
      } catch (err) {
        console.error('Lỗi xóa đơn:', err);
      }
    }
  });

  closeDetailBtn?.addEventListener('click', () => {
    document.getElementById('order-detail-modal')?.classList.add('hidden');
  });

  // Duyệt thanh toán VietQR & kích hoạt dịch vụ (status = completed)
  approvePaymentBtn?.addEventListener('click', async () => {
    if (!activeOrder) return;
    approvePaymentBtn.disabled = true;
    approvePaymentBtn.textContent = 'Đang duyệt & cấp IP...';
    try {
      await patchOrder(activeOrder.id, { status: 'completed' });
      const msg = document.getElementById('detail-save-msg');
      if (msg) {
        msg.textContent = 'Đã duyệt nhận tiền và kích hoạt IP Hosting thành công!';
        msg.classList.remove('hidden');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      approvePaymentBtn.disabled = false;
      approvePaymentBtn.textContent = 'Xác Nhận Đã Nhận Tiền & Kích Hoạt Dịch Vụ';
    }
  });

  // Lưu cập nhật trạng thái / phân công / ghi chú
  saveUpdateBtn?.addEventListener('click', async () => {
    if (!activeOrder) return;
    const status = document.getElementById('detail-status-select').value;
    const assignedTo = document.getElementById('detail-assignee-select').value;
    const notes = document.getElementById('detail-notes-input').value;

    saveUpdateBtn.disabled = true;
    saveUpdateBtn.textContent = 'Đang lưu...';
    try {
      const payload = { status, notes };
      if (adminUser?.role === 'admin') {
        payload.assignedTo = assignedTo;
      }
      await patchOrder(activeOrder.id, payload);
      const msg = document.getElementById('detail-save-msg');
      if (msg) {
        msg.textContent = 'Đã lưu cập nhật đơn hàng thành công!';
        msg.classList.remove('hidden');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      saveUpdateBtn.disabled = false;
      saveUpdateBtn.textContent = 'Lưu Cập Nhật Đơn Hàng';
    }
  });

  // Gọi AI Trợ lý Telesale (/api/advice/sales-script)
  generateScriptBtn?.addEventListener('click', async () => {
    if (!activeOrder) return;
    const scriptBox = document.getElementById('detail-sales-script-box');
    generateScriptBtn.disabled = true;
    generateScriptBtn.textContent = 'AI đang soạn...';
    scriptBox.textContent = 'Gemini AI đang phân tích thông tin đơn hàng và soạn kịch bản 3 bước...';

    try {
      const res = await fetch('/api/advice/sales-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ orderId: activeOrder.id })
      });
      const data = await res.json();
      if (res.ok && data.ok && data.script) {
        scriptBox.textContent = data.script;
      } else {
        scriptBox.textContent = data.error || 'Không tạo được kịch bản vào lúc này.';
      }
    } catch (err) {
      scriptBox.textContent = 'Lỗi kết nối khi gọi AI Telesale.';
    } finally {
      generateScriptBtn.disabled = false;
      generateScriptBtn.textContent = 'AI Soạn Kịch Bản Gọi Điện';
    }
  });

  // =========================================================
  // 6. SỰ KIỆN QUẢN LÝ NHÂN SỰ, COUPON & NGÂN HÀNG VIETQR (ADMIN)
  // =========================================================

  createStaffForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const msgEl = document.getElementById('staff-manage-msg');
    const username = document.getElementById('staff-new-username').value.trim();
    const password = document.getElementById('staff-new-password').value;
    const fullName = document.getElementById('staff-new-fullname').value.trim();
    const phone = document.getElementById('staff-new-phone').value.trim();

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ username, password, fullName, phone, role: 'staff' })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        msgEl.textContent = data.error || 'Không tạo được nhân viên.';
        msgEl.className = 'text-xs font-medium text-red-600';
        msgEl.classList.remove('hidden');
        return;
      }
      msgEl.textContent = `Đã tạo tài khoản nhân viên @${data.user.username} thành công!`;
      msgEl.className = 'text-xs font-medium text-emerald-700';
      msgEl.classList.remove('hidden');
      createStaffForm.reset();
      await loadStaffAndOrders();
    } catch (err) {
      msgEl.textContent = 'Lỗi kết nối máy chủ.';
      msgEl.className = 'text-xs font-medium text-red-600';
      msgEl.classList.remove('hidden');
    }
  });

  staffListContainer?.addEventListener('click', async (event) => {
    const delBtn = event.target.closest('.btn-delete-staff');
    if (!delBtn) return;
    const userId = delBtn.getAttribute('data-delete-staff-id');
    if (!userId) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) {
        await loadStaffAndOrders();
      }
    } catch (err) {
      console.error('Lỗi xóa nhân sự:', err);
    }
  });

  createCouponForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const msgEl = document.getElementById('coupon-manage-msg');
    const code = document.getElementById('coupon-new-code').value.trim().toUpperCase();
    const type = document.getElementById('coupon-new-type').value;
    const value = Number(document.getElementById('coupon-new-value').value);
    const description = document.getElementById('coupon-new-desc').value.trim();

    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ code, type, value, description })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        msgEl.textContent = data.error || 'Không thêm được mã giảm giá.';
        msgEl.className = 'text-xs font-medium text-red-600';
        msgEl.classList.remove('hidden');
        return;
      }
      msgEl.textContent = `Đã lưu mã giảm giá ${data.coupon.code} thành công!`;
      msgEl.className = 'text-xs font-medium text-emerald-700';
      msgEl.classList.remove('hidden');
      createCouponForm.reset();
      await loadStaffAndOrders();
    } catch (err) {
      msgEl.textContent = 'Lỗi kết nối máy chủ.';
      msgEl.className = 'text-xs font-medium text-red-600';
      msgEl.classList.remove('hidden');
    }
  });

  couponListContainer?.addEventListener('click', async (event) => {
    const delBtn = event.target.closest('.btn-delete-coupon');
    if (!delBtn) return;
    const code = delBtn.getAttribute('data-delete-coupon-code');
    if (!code) return;

    try {
      const res = await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) {
        await loadStaffAndOrders();
      }
    } catch (err) {
      console.error('Lỗi xóa mã giảm giá:', err);
    }
  });

  bankSettingsForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const msgEl = document.getElementById('bank-settings-msg');
    const bankId = document.getElementById('setting-bank-id').value.trim().toUpperCase();
    const accountNo = document.getElementById('setting-account-no').value.trim();
    const accountName = document.getElementById('setting-account-name').value.trim().toUpperCase();

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ bankId, accountNo, accountName })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        msgEl.textContent = data.error || 'Không lưu được cấu hình ngân hàng.';
        msgEl.className = 'text-xs font-medium text-red-600';
        msgEl.classList.remove('hidden');
        return;
      }
      msgEl.textContent = 'Đã cập nhật tài khoản ngân hàng VietQR thành công!';
      msgEl.className = 'text-xs font-medium text-emerald-700';
      msgEl.classList.remove('hidden');
      await loadStaffAndOrders();
    } catch (err) {
      msgEl.textContent = 'Lỗi kết nối máy chủ.';
      msgEl.className = 'text-xs font-medium text-red-600';
      msgEl.classList.remove('hidden');
    }
  });

  document.getElementById('admin-reviews-list')?.addEventListener('click', async (event) => {
    const delBtn = event.target.closest('.btn-delete-review');
    if (!delBtn) return;
    const revId = delBtn.getAttribute('data-delete-review-id');
    if (!revId) return;

    try {
      const res = await fetch(`/api/admin/reviews/${encodeURIComponent(revId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) {
        await loadStaffAndOrders();
      }
    } catch (err) {
      console.error('Lỗi xóa đánh giá:', err);
    }
  });
});
