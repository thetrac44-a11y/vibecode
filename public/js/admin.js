/**
 * public/js/admin.js
 * Logic Quản trị Đơn hàng (OMS), Phân quyền RBAC (Admin/Staff), Duyệt tiền VietQR, AI Telesale & Xuất CSV
 */

let adminToken = localStorage.getItem('ha_admin_token') || localStorage.getItem('ha_token') || '';
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);
let adminUser = null;
let allOrders = [];
let allLeads = [];
let staffUsers = [];
let allCoupons = [];
let allPlans = [];
let allDomains = [];
let allAddons = [];
let allCustomers = [];
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
  const systemTabBtn = document.getElementById('tab-btn-system');
  const systemTabPanel = document.getElementById('tab-panel-system');
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
      systemTabBtn?.classList.remove('hidden');
    } else {
      systemPanel?.classList.add('hidden');
      systemTabBtn?.classList.add('hidden');
      systemTabPanel?.classList.add('hidden');
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

  // Hiển thị ngay Dashboard từ payload JWT để không bị trễ hay nháy màn hình đăng nhập
  try {
    const payloadPart = adminToken.split('.')[1];
    if (payloadPart) {
      const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(decodeURIComponent(escape(window.atob(base64))));
      if (decoded && (decoded.role === 'admin' || decoded.role === 'staff')) {
        adminUser = decoded;
        syncAdminScreenUI();
      }
    }
  } catch (e) {
    // Bỏ qua nếu không giải mã tạm thời được, chờ /api/auth/me xác thực
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
      fetch('/api/catalog'),
      fetch('/api/leads', { headers: { Authorization: `Bearer ${adminToken}` } })
    ];

    if (adminUser?.role === 'admin') {
      requests.push(fetch('/api/admin/coupons', { headers: { Authorization: `Bearer ${adminToken}` } }));
      requests.push(fetch('/api/admin/customers', { headers: { Authorization: `Bearer ${adminToken}` } }));
    }

    const [staffRes, ordersRes, catalogRes, leadsRes, couponsRes, customersRes] = await Promise.all(requests);

    if (leadsRes && leadsRes.ok) {
      const lData = await leadsRes.json();
      if (lData.ok && Array.isArray(lData.leads)) {
        allLeads = lData.leads;
      }
    }

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

    renderStaffManagementList();

    if (catalogRes && catalogRes.ok) {
      const cData = await catalogRes.json();
      if (Array.isArray(cData.plans)) {
        allPlans = cData.plans;
        renderPlansManagementList();
      }
      if (Array.isArray(cData.domain_pricing)) {
        allDomains = cData.domain_pricing;
        renderDomainsManagementList();
      }
      if (Array.isArray(cData.addons)) {
        allAddons = cData.addons;
        renderAddonsManagementList();
      }
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

    if (customersRes && customersRes.ok) {
      const custData = await customersRes.json();
      allCustomers = Array.isArray(custData.customers) ? custData.customers : [];
      renderCustomersManagementList();
    }

    if (adminUser?.role === 'admin') {
      renderRevenueAnalytics();
      renderCustomersManagementList();
    }
  } catch (err) {
    console.error('Lỗi tải dữ liệu OMS:', err);
  }
}

function renderStaffManagementList() {
  const container = document.getElementById('staff-list-container');
  const leaderboardTbody = document.getElementById('admin-staff-leaderboard-tbody');

  if (container) {
    if (staffUsers.length === 0) {
      container.innerHTML = '<div class="text-slate-400">Chưa có nhân sự nào.</div>';
    } else {
      container.innerHTML = staffUsers
        .map((u) => {
          const isSelf = adminUser && u.id === adminUser.id;
          return `
            <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <div class="font-bold text-slate-900">${escapeHtml(u.fullName)} <span class="text-brand-700 font-mono">(@${escapeHtml(u.username)})</span></div>
                <div class="text-slate-500">Quyền: <strong>${escapeHtml(u.role.toUpperCase())}</strong> ${u.phone ? `— ${escapeHtml(u.phone)}` : ''}</div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  data-reset-staff-id="${escapeHtml(u.id)}"
                  data-reset-staff-username="${escapeHtml(u.username)}"
                  class="btn-reset-staff-pass py-1 px-2.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold transition-colors"
                >
                  Đổi MK
                </button>
                ${
                  !isSelf
                    ? `
                      <button
                        type="button"
                        data-delete-staff-id="${escapeHtml(u.id)}"
                        data-delete-staff-username="${escapeHtml(u.username)}"
                        class="btn-delete-staff py-1 px-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-semibold transition-colors"
                      >
                        Xóa
                      </button>
                    `
                    : '<span class="text-slate-400 font-semibold">Đang dùng</span>'
                }
              </div>
            </div>
          `;
        })
        .join('');
    }
  }

  if (leaderboardTbody) {
    if (staffUsers.length === 0) {
      leaderboardTbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-400">Chưa có dữ liệu nhân sự.</td></tr>';
      return;
    }

    const enrichedStaff = staffUsers
      .map((u) => {
        const assignedOrders = allOrders.filter((o) => o.assignedTo === u.id);
        const completedOrders = assignedOrders.filter((o) => o.status === 'completed' || o.paymentStatus === 'paid');
        const revenue = completedOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
        const commission = Math.round(revenue * 0.05);
        const assignedLeads = allLeads.filter((l) => l.assigned_to === u.id);
        const convertedLeads = assignedLeads.filter((l) => l.status === 'converted');
        return {
          ...u,
          assignedOrdersCount: assignedOrders.length,
          completedOrdersCount: completedOrders.length,
          revenue,
          commission,
          assignedLeadsCount: assignedLeads.length,
          convertedLeadsCount: convertedLeads.length
        };
      })
      .sort((a, b) => b.revenue - a.revenue || b.completedOrdersCount - a.completedOrdersCount);

    leaderboardTbody.innerHTML = enrichedStaff
      .map((u) => {
        const isSelf = adminUser && u.id === adminUser.id;
        const convRate = u.assignedLeadsCount > 0 ? Math.round((u.convertedLeadsCount / u.assignedLeadsCount) * 100) : 0;
        return `
          <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-3">
              <div class="font-bold text-slate-900">${escapeHtml(u.fullName)} <span class="text-brand-700 font-mono text-xs">(@${escapeHtml(u.username)})</span></div>
              <div class="text-xs text-slate-500">${escapeHtml(u.phone || 'Chưa cập nhật SĐT')}</div>
            </td>
            <td class="p-3">
              <span class="inline-block text-xs font-bold uppercase px-2.5 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-brand-50 text-brand-700 border border-brand-200'}">
                ${escapeHtml(u.role)}
              </span>
            </td>
            <td class="p-3 font-semibold text-slate-800">
              ${u.completedOrdersCount} / ${u.assignedOrdersCount} đơn
            </td>
            <td class="p-3 font-extrabold text-emerald-700">
              ${formatVND(u.revenue)}
            </td>
            <td class="p-3 font-bold text-amber-700">
              ${formatVND(u.commission)}
            </td>
            <td class="p-3 text-xs font-semibold text-slate-700">
              ${convRate}% (${u.convertedLeadsCount}/${u.assignedLeadsCount} Lead)
            </td>
            <td class="p-3 text-right space-x-1.5 whitespace-nowrap">
              <button
                type="button"
                data-reset-staff-id="${escapeHtml(u.id)}"
                data-reset-staff-username="${escapeHtml(u.username)}"
                class="btn-reset-staff-pass py-1 px-2.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold transition-colors"
              >
                Đổi MK
              </button>
              ${
                !isSelf
                  ? `
                    <button
                      type="button"
                      data-delete-staff-id="${escapeHtml(u.id)}"
                      data-delete-staff-username="${escapeHtml(u.username)}"
                      class="btn-delete-staff py-1 px-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition-colors"
                    >
                      Xóa
                    </button>
                  `
                  : '<span class="text-xs text-slate-400 font-semibold">Bạn</span>'
              }
            </td>
          </tr>
        `;
      })
      .join('');
  }
}

function renderPlansManagementList() {
  const container = document.getElementById('admin-plans-list');
  if (!container) return;

  if (!Array.isArray(allPlans) || allPlans.length === 0) {
    container.innerHTML = '<div class="sm:col-span-2 lg:col-span-4 text-slate-400">Đang tải danh sách gói Hosting...</div>';
    return;
  }

  container.innerHTML = allPlans
    .map((p) => {
      const priceVal = Number(p.pricePerMonth ?? p.priceMonthly ?? 0);
      return `
        <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 flex flex-col justify-between">
          <div>
            <div class="font-bold text-slate-900 text-sm">Gói ${escapeHtml(p.name)}</div>
            <div class="text-slate-500 text-xs mt-0.5">${escapeHtml(p.storage || '')} • ${escapeHtml(p.bandwidth || '')}</div>
          </div>
          <div class="space-y-2 pt-2 border-t border-slate-200">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Đơn giá tháng (VNĐ):</label>
              <input
                type="number"
                data-plan-price-input="${escapeHtml(p.id)}"
                value="${priceVal}"
                class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono font-bold text-slate-900 focus:border-brand-600 focus:outline-none"
              />
            </div>
            <label class="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                data-plan-domain-checkbox="${escapeHtml(p.id)}"
                ${p.freeDomain ? 'checked' : ''}
                class="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>Tặng miễn phí tên miền năm đầu</span>
            </label>
            <button
              type="button"
              data-save-plan-id="${escapeHtml(p.id)}"
              class="btn-save-plan w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors"
            >
              Lưu Giá Gói ${escapeHtml(p.name)}
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderRevenueAnalytics() {
  const byPlanEl = document.getElementById('analytics-by-plan');
  const byCycleEl = document.getElementById('analytics-by-cycle');
  const bySourceEl = document.getElementById('analytics-by-source');
  if (!byPlanEl || !byCycleEl || !bySourceEl) return;

  const paidOrders = allOrders.filter((o) => o.status === 'completed' || o.paymentStatus === 'paid');
  const totalRev = paidOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

  // 1. Doanh thu theo Gói Hosting
  const planMap = {};
  paidOrders.forEach((o) => {
    const key = o.planName || o.planId || 'Khác';
    if (!planMap[key]) planMap[key] = { count: 0, rev: 0 };
    planMap[key].count += 1;
    planMap[key].rev += Number(o.totalAmount) || 0;
  });
  const planEntries = Object.entries(planMap).sort((a, b) => b[1].rev - a[1].rev);
  if (planEntries.length === 0) {
    byPlanEl.innerHTML = '<div class="text-slate-400">Chưa có đơn hàng đã thanh toán.</div>';
  } else {
    byPlanEl.innerHTML = planEntries
      .map(([name, info]) => {
        const pct = totalRev > 0 ? Math.round((info.rev / totalRev) * 100) : 0;
        return `
          <div class="space-y-1">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-slate-800">Gói ${escapeHtml(name)} (${info.count} đơn)</span>
              <span class="font-extrabold text-brand-700">${formatVND(info.rev)} (${pct}%)</span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div class="h-full bg-brand-600 rounded-full" style="width: ${Math.max(pct, 4)}%"></div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // 2. Doanh thu theo Chu kỳ thanh toán
  const cycleMap = {
    12: { label: 'Chu kỳ 12 Tháng (1 năm)', count: 0, rev: 0 },
    24: { label: 'Chu kỳ 24 Tháng (2 năm)', count: 0, rev: 0 },
    36: { label: 'Chu kỳ 36 Tháng (3 năm)', count: 0, rev: 0 }
  };
  paidOrders.forEach((o) => {
    const m = Number(o.cycleMonths) || 12;
    if (!cycleMap[m]) {
      cycleMap[m] = { label: `Chu kỳ ${m} Tháng`, count: 0, rev: 0 };
    }
    cycleMap[m].count += 1;
    cycleMap[m].rev += Number(o.totalAmount) || 0;
  });
  byCycleEl.innerHTML = Object.values(cycleMap)
    .map((info) => {
      const pct = totalRev > 0 ? Math.round((info.rev / totalRev) * 100) : 0;
      return `
        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-800">${escapeHtml(info.label)} (${info.count} đơn)</span>
            <span class="font-extrabold text-emerald-700">${formatVND(info.rev)} (${pct}%)</span>
          </div>
          <div class="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
            <div class="h-full bg-emerald-600 rounded-full" style="width: ${info.rev > 0 ? Math.max(pct, 4) : 0}%"></div>
          </div>
        </div>
      `;
    })
    .join('');

  // 3. Tỷ trọng nguồn thu (Hosting / Tên miền / Dịch vụ bổ trợ)
  let hostingSum = 0;
  let domainSum = 0;
  let addonsSum = 0;
  paidOrders.forEach((o) => {
    const dFee = Number(o.domainFee) || 0;
    const aFee = Number(o.addonsTotal) || 0;
    const hFee = Number(o.hostingSubtotal) || Math.max(0, (Number(o.totalAmount) || 0) - dFee - aFee);
    hostingSum += hFee;
    domainSum += dFee;
    addonsSum += aFee;
  });
  const grossSum = hostingSum + domainSum + addonsSum;
  const sources = [
    { label: 'Dịch vụ Web Hosting cốt lõi', val: hostingSum, barClass: 'bg-brand-600', textClass: 'text-brand-700' },
    { label: 'Đăng ký Tên miền (.vn, .com...)', val: domainSum, barClass: 'bg-amber-500', textClass: 'text-amber-700' },
    { label: 'Dịch vụ bổ trợ (Add-ons)', val: addonsSum, barClass: 'bg-emerald-600', textClass: 'text-emerald-700' }
  ];
  bySourceEl.innerHTML = sources
    .map((s) => {
      const pct = grossSum > 0 ? Math.round((s.val / grossSum) * 100) : 0;
      return `
        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-800">${escapeHtml(s.label)}</span>
            <span class="font-extrabold ${s.textClass}">${formatVND(s.val)} (${pct}%)</span>
          </div>
          <div class="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
            <div class="h-full ${s.barClass} rounded-full" style="width: ${s.val > 0 ? Math.max(pct, 4) : 0}%"></div>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderCustomersManagementList() {
  const tbody = document.getElementById('admin-customers-tbody');
  const countBadge = document.getElementById('admin-customers-count-badge');
  if (!tbody) return;

  if (countBadge) {
    countBadge.textContent = `${allCustomers.length} khách hàng`;
  }

  if (!Array.isArray(allCustomers) || allCustomers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Chưa có tài khoản khách hàng thành viên nào.</td></tr>';
    return;
  }

  const enrichedCustomers = allCustomers
    .map((c) => {
      const custOrders = allOrders.filter(
        (o) =>
          (c.id && o.userId === c.id) ||
          (c.email && o.customerEmail && o.customerEmail.toLowerCase() === c.email.toLowerCase()) ||
          (c.phone && o.customerPhone && o.customerPhone === c.phone)
      );
      const paidOrders = custOrders.filter((o) => o.status === 'completed' || o.paymentStatus === 'paid');
      const ltv = paidOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
      return {
        ...c,
        totalOrdersCount: custOrders.length,
        paidOrdersCount: paidOrders.length,
        ltv
      };
    })
    .sort((a, b) => b.ltv - a.ltv || b.totalOrdersCount - a.totalOrdersCount);

  tbody.innerHTML = enrichedCustomers
    .map((c) => {
      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="p-3">
            <div class="font-bold text-slate-900">${escapeHtml(c.fullName || 'Khách hàng')}</div>
            <div class="text-xs font-mono text-brand-700">@${escapeHtml(c.username)}</div>
          </td>
          <td class="p-3 font-mono text-xs text-slate-800">
            ${escapeHtml(c.phone || 'Chưa cập nhật')}
          </td>
          <td class="p-3 text-xs text-slate-700">
            ${escapeHtml(c.email || 'Chưa cập nhật')}
          </td>
          <td class="p-3 font-semibold text-slate-800">
            ${c.paidOrdersCount} kích hoạt / ${c.totalOrdersCount} đơn
          </td>
          <td class="p-3 font-extrabold text-emerald-700">
            ${formatVND(c.ltv)}
          </td>
          <td class="p-3 text-right space-x-1.5 whitespace-nowrap">
            <button
              type="button"
              data-reset-staff-id="${escapeHtml(c.id)}"
              data-reset-staff-username="${escapeHtml(c.username)}"
              class="btn-reset-staff-pass py-1 px-2.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold transition-colors"
            >
              Đổi MK
            </button>
            <button
              type="button"
              data-delete-staff-id="${escapeHtml(c.id)}"
              data-delete-staff-username="${escapeHtml(c.username)}"
              class="btn-delete-staff py-1 px-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition-colors"
            >
              Xóa
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderDomainsManagementList() {
  const container = document.getElementById('admin-domains-list');
  if (!container) return;

  if (!Array.isArray(allDomains) || allDomains.length === 0) {
    container.innerHTML = '<div class="text-slate-400">Chưa có danh mục đuôi tên miền.</div>';
    return;
  }

  container.innerHTML = allDomains
    .map((d) => {
      const ext = d.extension || d.ext || '';
      const priceVal = Number(d.price ?? d.pricePerYear ?? 0);
      return `
        <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <div class="min-w-[70px]">
            <span class="font-mono font-extrabold text-sm text-brand-700">${escapeHtml(ext)}</span>
            <div class="text-[11px] text-slate-500">Phí / 1 năm</div>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="number"
              data-domain-price-input="${escapeHtml(ext)}"
              value="${priceVal}"
              class="w-32 rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-mono font-bold text-slate-900 focus:border-brand-600 focus:outline-none"
            />
            <button
              type="button"
              data-save-domain-ext="${escapeHtml(ext)}"
              class="btn-save-domain py-1 px-3 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-colors"
            >
              Lưu
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderAddonsManagementList() {
  const container = document.getElementById('admin-addons-list');
  if (!container) return;

  if (!Array.isArray(allAddons) || allAddons.length === 0) {
    container.innerHTML = '<div class="text-slate-400">Chưa có danh mục dịch vụ bổ trợ (Add-ons).</div>';
    return;
  }

  container.innerHTML = allAddons
    .map((a) => {
      const priceVal = Number(a.price ?? 0);
      const billingLabel = a.billingType === 'monthly' ? 'Phí / tháng' : 'Phí / năm';
      return `
        <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <div class="font-bold text-slate-900">${escapeHtml(a.name || a.id)}</div>
            <div class="text-[11px] text-slate-500">${escapeHtml(billingLabel)}</div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <input
              type="number"
              data-addon-price-input="${escapeHtml(a.id)}"
              value="${priceVal}"
              class="w-32 rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-mono font-bold text-slate-900 focus:border-brand-600 focus:outline-none"
            />
            <button
              type="button"
              data-save-addon-id="${escapeHtml(a.id)}"
              class="btn-save-addon py-1 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors"
            >
              Lưu
            </button>
          </div>
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
      <option value="mine">Đơn của tôi phụ trách</option>
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
  updatePersonalKPIs();
}

function updatePersonalKPIs() {
  const staffNameEl = document.getElementById('my-kpi-staff-name');
  const myOrdersEl = document.getElementById('my-kpi-orders');
  const myRevenueEl = document.getElementById('my-kpi-revenue');
  const myCommissionEl = document.getElementById('my-kpi-commission');
  const myConversionEl = document.getElementById('my-kpi-conversion');

  if (staffNameEl) {
    staffNameEl.textContent = adminUser?.fullName || adminUser?.username || 'Bạn';
  }

  const myOrders = allOrders.filter((o) => adminUser && o.assignedTo === adminUser.id);
  const myCompletedOrders = myOrders.filter((o) => o.status === 'completed' || o.paymentStatus === 'paid');
  const myRevenue = myCompletedOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const myCommission = Math.round(myRevenue * 0.05);

  const myLeads = allLeads.filter((l) => adminUser && l.assigned_to === adminUser.id);
  const myConvertedLeads = myLeads.filter((l) => l.status === 'converted');
  const conversionRate = myLeads.length > 0 ? Math.round((myConvertedLeads.length / myLeads.length) * 100) : 0;

  if (myOrdersEl) myOrdersEl.textContent = `${myCompletedOrders.length} / ${myOrders.length} đơn`;
  if (myRevenueEl) myRevenueEl.textContent = formatVND(myRevenue);
  if (myCommissionEl) myCommissionEl.textContent = formatVND(myCommission);
  if (myConversionEl) myConversionEl.textContent = `${conversionRate}% (${myConvertedLeads.length}/${myLeads.length})`;
}

function getFilteredOrders() {
  const searchVal = (document.getElementById('filter-search')?.value || '').trim().toLowerCase();
  const statusVal = document.getElementById('filter-status')?.value || 'all';
  const assigneeVal = document.getElementById('filter-assignee')?.value || 'all';

  return allOrders.filter((o) => {
    if (statusVal !== 'all' && o.status !== statusVal) return false;
    if (assigneeVal === 'mine' && (!adminUser || o.assignedTo !== adminUser.id)) return false;
    if (assigneeVal === 'unassigned' && o.assignedTo) return false;
    if (assigneeVal !== 'all' && assigneeVal !== 'mine' && assigneeVal !== 'unassigned' && o.assignedTo !== assigneeVal) return false;

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

      const isMine = adminUser && o.assignedTo === adminUser.id;
      const isUnassigned = !o.assignedTo;
      let orderAssigneeHtml = '';
      if (isMine) {
        orderAssigneeHtml = `<span class="inline-block px-2.5 py-0.5 text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200 rounded-full">Bạn phụ trách</span>`;
      } else if (isUnassigned) {
        orderAssigneeHtml = `
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-slate-400">Chưa có</span>
            <button
              type="button"
              data-claim-order-id="${escapeHtml(o.id)}"
              class="btn-quick-claim-order text-xs font-bold px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md transition-colors"
            >
              Nhận đơn
            </button>
          </div>
        `;
      } else {
        orderAssigneeHtml = `<span class="text-xs text-slate-700 font-medium">${escapeHtml(o.assignedToName || 'Đã phân công')}</span>`;
      }

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
            ${orderAssigneeHtml}
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
          <div class="mt-2 pt-2 border-t border-slate-200 text-emerald-800 space-y-1 text-xs">
            <div class="font-bold">Thông số Bàn giao Kỹ thuật (Control Panel cPanel):</div>
            <div>IP Server: <code class="font-mono font-bold">${escapeHtml(order.serviceDetails.hostingIp)}</code> | DNS: <code class="font-mono">${escapeHtml((order.serviceDetails.nameServers || []).join(', '))}</code></div>
            <div>URL cPanel: <code class="font-mono">${escapeHtml(order.serviceDetails.controlPanelUrl || 'https://cp.hostingadvisor.vn:2083')}</code></div>
            <div>Username: <code class="font-mono font-bold">${escapeHtml(order.serviceDetails.cpUsername || 'ha_user')}</code> | Mật khẩu: <code class="font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">${escapeHtml(order.serviceDetails.cpPassword || 'Ha@2026')}</code></div>
          </div>
        `
        : ''
    }
  `;

  const approveBtn = document.getElementById('btn-approve-payment');
  const paymentText = document.getElementById('detail-payment-status-text');
  const copyReminderBtn = document.getElementById('btn-copy-payment-reminder');
  const copyHandoverBtn = document.getElementById('btn-copy-handover-info');
  const resetCpanelPassBtn = document.getElementById('btn-reset-cpanel-pass');
  const staffCreateRenewalBtn = document.getElementById('btn-staff-create-renewal');
  const toolFeedbackEl = document.getElementById('detail-tool-feedback');
  if (toolFeedbackEl) toolFeedbackEl.classList.add('hidden');

  if (order.status === 'completed' || order.paymentStatus === 'paid') {
    paymentText.textContent = 'Đơn hàng này đã được xác nhận thanh toán đủ và kích hoạt IP Hosting.';
    approveBtn.classList.add('hidden');
    copyReminderBtn?.classList.add('hidden');
    copyHandoverBtn?.classList.remove('hidden');
    resetCpanelPassBtn?.classList.remove('hidden');
    staffCreateRenewalBtn?.classList.remove('hidden');
  } else {
    paymentText.textContent = `Cần thu: ${formatVND(order.totalAmount)} — Bấm nút bên cạnh để xác nhận đã nhận tiền VietQR và cấp IP Hosting.`;
    approveBtn.classList.remove('hidden');
    copyReminderBtn?.classList.remove('hidden');
    copyHandoverBtn?.classList.add('hidden');
    resetCpanelPassBtn?.classList.add('hidden');
    staffCreateRenewalBtn?.classList.add('hidden');
  }

  const statusSelect = document.getElementById('detail-status-select');
  const assigneeSelect = document.getElementById('detail-assignee-select');
  const notesInput = document.getElementById('detail-notes-input');
  const orderAdminAssigneeBox = document.getElementById('order-assignee-admin-box');
  const orderStaffAssigneeBox = document.getElementById('order-assignee-staff-box');
  const orderStaffAssigneeName = document.getElementById('order-staff-assignee-name');
  const staffClaimOrderBtn = document.getElementById('btn-staff-claim-order');

  statusSelect.value = order.status || 'pending_payment';
  assigneeSelect.value = order.assignedTo || '';
  assigneeSelect.disabled = adminUser?.role !== 'admin';
  notesInput.value = order.notes || '';
  document.getElementById('detail-save-msg')?.classList.add('hidden');

  if (adminUser?.role === 'admin') {
    orderAdminAssigneeBox?.classList.remove('hidden');
    orderStaffAssigneeBox?.classList.add('hidden');
  } else {
    orderAdminAssigneeBox?.classList.add('hidden');
    orderStaffAssigneeBox?.classList.remove('hidden');
    if (orderStaffAssigneeName) {
      orderStaffAssigneeName.textContent = order.assignedToName || 'Chưa phân công';
    }
    if (staffClaimOrderBtn) {
      if (adminUser && order.assignedTo === adminUser.id) {
        staffClaimOrderBtn.textContent = 'Bạn đang phụ trách';
        staffClaimOrderBtn.disabled = true;
        staffClaimOrderBtn.className = 'text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 shrink-0';
      } else if (order.assignedTo) {
        staffClaimOrderBtn.textContent = 'Đã có người phụ trách';
        staffClaimOrderBtn.disabled = true;
        staffClaimOrderBtn.className = 'text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed shrink-0';
      } else {
        staffClaimOrderBtn.textContent = 'Nhận Xử Lý Đơn Này';
        staffClaimOrderBtn.disabled = false;
        staffClaimOrderBtn.className = 'bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors shrink-0';
      }
    }
  }

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
      localStorage.setItem('ha_token', adminToken);
      localStorage.removeItem('ha_last_buyer');
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
    localStorage.removeItem('ha_token');
    localStorage.removeItem('ha_last_buyer');
    syncAdminScreenUI();
  });

  refreshBtn?.addEventListener('click', () => loadStaffAndOrders());
  exportBtn?.addEventListener('click', exportOrdersToCSV);

  document.getElementById('filter-search')?.addEventListener('input', renderOrdersTable);
  document.getElementById('filter-status')?.addEventListener('change', renderOrdersTable);
  document.getElementById('filter-assignee')?.addEventListener('change', renderOrdersTable);

  tbody?.addEventListener('click', async (event) => {
    const claimOrderBtn = event.target.closest('.btn-quick-claim-order');
    if (claimOrderBtn) {
      const claimId = claimOrderBtn.getAttribute('data-claim-order-id');
      if (!claimId) return;
      claimOrderBtn.disabled = true;
      claimOrderBtn.textContent = 'Đang nhận...';
      try {
        const res = await fetch(`/api/orders/${claimId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ action: 'claim' })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          alert(data.error || 'Không thể tiếp nhận đơn hàng này.');
        }
        await loadStaffAndOrders();
      } catch (err) {
        alert('Lỗi kết nối khi nhận đơn: ' + err.message);
      }
      return;
    }

    const detailBtn = event.target.closest('.btn-open-detail');
    if (detailBtn) {
      openOrderDetailModal(detailBtn.getAttribute('data-detail-order-id'));
      return;
    }

    const delBtn = event.target.closest('.btn-delete-order');
    if (delBtn) {
      const id = delBtn.getAttribute('data-delete-order-id');
      if (!id) return;
      if (!confirm(`Xác nhận xóa vĩnh viễn đơn hàng ${id} khỏi hệ thống?`)) return;
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

  document.getElementById('btn-staff-claim-order')?.addEventListener('click', async () => {
    if (!activeOrder) return;
    const claimBtn = document.getElementById('btn-staff-claim-order');
    if (claimBtn) {
      claimBtn.disabled = true;
      claimBtn.textContent = 'Đang nhận đơn...';
    }
    try {
      await patchOrder(activeOrder.id, { action: 'claim' });
      const msg = document.getElementById('detail-save-msg');
      if (msg) {
        msg.textContent = 'Bạn đã tiếp nhận phụ trách xử lý đơn hàng này!';
        msg.classList.remove('hidden');
      }
    } catch (err) {
      alert(err.message);
    }
  });

  closeDetailBtn?.addEventListener('click', () => {
    document.getElementById('order-detail-modal')?.classList.add('hidden');
  });

  // Nút lọc nhanh "Chỉ Xem Đơn Của Tôi" trên thanh Hiệu Suất Cá Nhân
  const quickFilterMineBtn = document.getElementById('btn-quick-filter-mine');
  quickFilterMineBtn?.addEventListener('click', () => {
    const filterAssignee = document.getElementById('filter-assignee');
    if (!filterAssignee) return;
    if (filterAssignee.value === 'mine') {
      filterAssignee.value = 'all';
      quickFilterMineBtn.textContent = 'Chỉ Xem Đơn Của Tôi';
      quickFilterMineBtn.className = 'py-1.5 px-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors self-start sm:self-auto';
    } else {
      filterAssignee.value = 'mine';
      quickFilterMineBtn.textContent = 'Đang Lọc: Đơn Của Tôi (Bấm Để Xem Tất Cả)';
      quickFilterMineBtn.className = 'py-1.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-bold transition-colors self-start sm:self-auto';
    }
    renderOrdersTable();
  });

  // Công cụ CSKH 1-Click: Copy tin nhắn nhắc thanh toán
  document.getElementById('btn-copy-payment-reminder')?.addEventListener('click', async () => {
    if (!activeOrder) return;
    const bankId = window.APP_CONFIG?.BANK_ID || bankSettings.bankId || 'MB';
    const accountNo = window.APP_CONFIG?.ACCOUNT_NO || bankSettings.accountNo || '0988123456';
    const accountName = window.APP_CONFIG?.ACCOUNT_NAME || bankSettings.accountName || 'CONG TY TNHH HOSTING ADVISOR';
    const reminderText = [
      `[HOSTINGADVISOR VIỆT NAM - THÔNG BÁO THANH TOÁN ĐƠN HÀNG]`,
      `Kính gửi anh/chị ${activeOrder.customerName},`,
      `Đơn đăng ký dịch vụ của anh/chị đã được khởi tạo trên hệ thống:`,
      `- Mã đơn hàng: ${activeOrder.id}`,
      `- Gói dịch vụ: Gói ${activeOrder.planName} (${activeOrder.billingCycleMonths} tháng)${activeOrder.domainName ? ` | Tên miền: ${activeOrder.domainName}` : ''}`,
      `- Tổng thanh toán: ${formatVND(activeOrder.totalAmount)}`,
      `- Ngân hàng nhận: ${bankId} - Số tài khoản: ${accountNo} (${accountName})`,
      `- Nội dung chuyển khoản: ${activeOrder.id}`,
      `Ngay sau khi nhận được thanh toán, hệ thống sẽ kích hoạt IP Hosting và gửi thông tin quản trị cPanel cho anh/chị. Trân trọng cảm ơn!`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(reminderText);
      const fb = document.getElementById('detail-tool-feedback');
      if (fb) {
        fb.textContent = 'Đã copy tin nhắn nhắc thanh toán vào bộ nhớ tạm!';
        fb.classList.remove('hidden');
      }
    } catch (err) {
      alert('Không thể copy tự động: ' + err.message);
    }
  });

  // Công cụ Kỹ thuật 1-Click: Copy bản tin bàn giao Hosting cPanel
  document.getElementById('btn-copy-handover-info')?.addEventListener('click', async () => {
    if (!activeOrder || !activeOrder.serviceDetails) return;
    const sd = activeOrder.serviceDetails;
    const expireStr = sd.expireDate
      ? new Date(sd.expireDate).toLocaleDateString('vi-VN')
      : new Date(new Date(activeOrder.createdAt).getTime() + (Number(activeOrder.billingCycleMonths) || 12) * 30 * 86400000).toLocaleDateString('vi-VN');

    const handoverText = [
      `[HOSTINGADVISOR VIỆT NAM - BÀN GIAO THÔNG TIN QUẢN TRỊ HOSTING & TÊN MIỀN]`,
      `Kính gửi anh/chị ${activeOrder.customerName},`,
      `Dịch vụ thuộc đơn hàng ${activeOrder.id} đã được kích hoạt hoàn tất:`,
      `- Gói Hosting: Gói ${activeOrder.planName} (${activeOrder.billingCycleMonths} tháng)`,
      `- Tên miền: ${activeOrder.domainName || 'Chưa gắn tên miền'}`,
      `- Địa chỉ IP Server: ${sd.hostingIp}`,
      `- Đường dẫn Control Panel (cPanel): ${sd.controlPanelUrl || 'https://cp.hostingadvisor.vn:2083'}`,
      `- Tài khoản cPanel (Username): ${sd.cpUsername || 'ha_user'}`,
      `- Mật khẩu cPanel (Password): ${sd.cpPassword || 'Ha@2026'}`,
      `- Cặp DNS Nameservers: ${(sd.nameServers || []).join(', ')}`,
      `- Ngày hết hạn dịch vụ: ${expireStr}`,
      `Anh/chị có thể đăng nhập tại trang chủ HostingAdvisor và mở mục "Quản Trị Hosting (cPanel)" để cài đặt WordPress 1-Click. Trân trọng cảm ơn!`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(handoverText);
      const fb = document.getElementById('detail-tool-feedback');
      if (fb) {
        fb.textContent = 'Đã copy toàn bộ thông tin bàn giao Hosting (cPanel/IP/DNS)!';
        fb.classList.remove('hidden');
      }
    } catch (err) {
      alert('Không thể copy tự động: ' + err.message);
    }
  });

  // Công cụ Kỹ thuật 1-Click: Cấp lại mật khẩu cPanel mới cho khách hàng
  document.getElementById('btn-reset-cpanel-pass')?.addEventListener('click', async () => {
    if (!activeOrder) return;
    const resetBtn = document.getElementById('btn-reset-cpanel-pass');
    if (resetBtn) {
      resetBtn.disabled = true;
      resetBtn.textContent = 'Đang cấp mật khẩu mới...';
    }
    try {
      await patchOrder(activeOrder.id, { action: 'reset_cpanel_password' });
      const fb = document.getElementById('detail-tool-feedback');
      if (fb) {
        fb.textContent = 'Đã cấp lại mật khẩu cPanel mới và ghi nhận vào Timeline!';
        fb.classList.remove('hidden');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      if (resetBtn) {
        resetBtn.disabled = false;
        resetBtn.textContent = 'Cấp Lại Mật Khẩu cPanel Mới';
      }
    }
  });

  // Công cụ CSKH 1-Click: Khởi tạo đơn gia hạn 12 tháng hộ khách hàng
  document.getElementById('btn-staff-create-renewal')?.addEventListener('click', async () => {
    if (!activeOrder) return;
    const renewalBtn = document.getElementById('btn-staff-create-renewal');
    if (renewalBtn) {
      renewalBtn.disabled = true;
      renewalBtn.textContent = 'Đang tạo đơn gia hạn...';
    }
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          customerName: activeOrder.customerName,
          phone: activeOrder.phone,
          email: activeOrder.email || '',
          planId: activeOrder.planId || 'pro',
          billingCycleMonths: 12,
          domainName: activeOrder.domainName || '',
          notes: `Đơn gia hạn thêm 12 tháng từ đơn gốc ${activeOrder.id}`,
          createdByStaff: true,
          isRenewalOrder: true,
          targetUserId: activeOrder.userId || null
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.order) {
        alert(data.error || 'Không thể khởi tạo đơn gia hạn.');
        return;
      }
      await loadStaffAndOrders();
      openOrderDetailModal(data.order.id);
      const fb = document.getElementById('detail-tool-feedback');
      if (fb) {
        fb.textContent = `Đã tạo đơn gia hạn mới (${data.order.id})! Bạn có thể bấm Copy Tin Nhắn Nhắc Thanh Toán để gửi cho khách.`;
        fb.classList.remove('hidden');
      }
    } catch (err) {
      alert('Lỗi tạo đơn gia hạn: ' + err.message);
    } finally {
      if (renewalBtn) {
        renewalBtn.disabled = false;
        renewalBtn.textContent = 'Tạo Đơn Gia Hạn (12 Tháng)';
      }
    }
  });

  // Nghiệp vụ Tạo Đơn Hàng Hộ Khách Qua Điện Thoại (Quick Order Modal)
  const quickOrderModal = document.getElementById('quick-order-modal');
  const quickOrderForm = document.getElementById('quick-order-form');
  const qoErrorMsg = document.getElementById('qo-error-msg');
  const qoDomainStatus = document.getElementById('qo-domain-status');

  function closeQuickOrderModal() {
    quickOrderModal?.classList.add('hidden');
    qoErrorMsg?.classList.add('hidden');
    qoDomainStatus?.classList.add('hidden');
  }

  document.getElementById('btn-open-quick-order')?.addEventListener('click', () => {
    quickOrderForm?.reset();
    qoErrorMsg?.classList.add('hidden');
    qoDomainStatus?.classList.add('hidden');
    quickOrderModal?.classList.remove('hidden');
  });

  // Kiểm tra tên miền trực tiếp ngay trong cửa sổ Tạo Đơn Hộ Khách
  document.getElementById('btn-qo-check-domain')?.addEventListener('click', async () => {
    const rawDomain = (document.getElementById('qo-domain')?.value || '').trim().toLowerCase();
    const checkBtn = document.getElementById('btn-qo-check-domain');
    if (!rawDomain) {
      if (qoDomainStatus) {
        qoDomainStatus.textContent = 'Vui lòng nhập tên miền khách muốn kiểm tra (VD: congtyabc.vn).';
        qoDomainStatus.className = 'text-xs font-medium mt-1 text-amber-700';
        qoDomainStatus.classList.remove('hidden');
      }
      return;
    }

    if (checkBtn) {
      checkBtn.disabled = true;
      checkBtn.textContent = 'Đang tra...';
    }

    try {
      const res = await fetch(`/api/domains/check?domain=${encodeURIComponent(rawDomain)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (qoDomainStatus) {
          qoDomainStatus.textContent = data.error || 'Không thể kiểm tra tên miền.';
          qoDomainStatus.className = 'text-xs font-medium mt-1 text-red-600';
          qoDomainStatus.classList.remove('hidden');
        }
        return;
      }

      const primary = data.primary || (Array.isArray(data.results) ? data.results[0] : null);
      if (primary && primary.available) {
        const domainInput = document.getElementById('qo-domain');
        if (domainInput) domainInput.value = primary.domain;
        if (qoDomainStatus) {
          qoDomainStatus.textContent = `Còn trống: ${primary.domain} có thể đăng ký ngay (Phí lẻ: ${formatVND(primary.price)}/năm — miễn phí nếu chọn gói Business/Enterprise).`;
          qoDomainStatus.className = 'text-xs font-semibold mt-1 text-emerald-700';
          qoDomainStatus.classList.remove('hidden');
        }
      } else if (primary) {
        const altAvail = (data.results || []).filter((r) => r.available).map((r) => r.domain).slice(0, 3);
        if (qoDomainStatus) {
          qoDomainStatus.textContent = `Đã có chủ: ${primary.domain} (${primary.reason}). ${altAvail.length ? 'Gợi ý còn trống: ' + altAvail.join(', ') : ''}`;
          qoDomainStatus.className = 'text-xs font-semibold mt-1 text-red-600';
          qoDomainStatus.classList.remove('hidden');
        }
      }
    } catch (err) {
      if (qoDomainStatus) {
        qoDomainStatus.textContent = 'Lỗi kết nối khi kiểm tra tên miền.';
        qoDomainStatus.className = 'text-xs font-medium mt-1 text-red-600';
        qoDomainStatus.classList.remove('hidden');
      }
    } finally {
      if (checkBtn) {
        checkBtn.disabled = false;
        checkBtn.textContent = 'Kiểm tra';
      }
    }
  });

  // Hồ sơ cá nhân & Đổi mật khẩu cho Staff / Admin ngay trên trang Quản trị
  const adminProfileModal = document.getElementById('admin-profile-modal');
  const adminProfileForm = document.getElementById('admin-profile-form');
  const apFeedbackMsg = document.getElementById('ap-feedback-msg');

  function closeAdminProfileModal() {
    adminProfileModal?.classList.add('hidden');
    apFeedbackMsg?.classList.add('hidden');
  }

  document.getElementById('btn-admin-profile')?.addEventListener('click', () => {
    if (!adminUser) return;
    const uEl = document.getElementById('ap-username');
    const rEl = document.getElementById('ap-role');
    const fEl = document.getElementById('ap-fullname');
    const pEl = document.getElementById('ap-phone');
    const eEl = document.getElementById('ap-email');
    const cpEl = document.getElementById('ap-current-password');
    const npEl = document.getElementById('ap-new-password');

    if (uEl) uEl.textContent = `@${adminUser.username}`;
    if (rEl) rEl.textContent = (adminUser.role || 'staff').toUpperCase();
    if (fEl) fEl.value = adminUser.fullName || '';
    if (pEl) pEl.value = adminUser.phone || '';
    if (eEl) eEl.value = adminUser.email || '';
    if (cpEl) cpEl.value = '';
    if (npEl) npEl.value = '';
    apFeedbackMsg?.classList.add('hidden');
    adminProfileModal?.classList.remove('hidden');
  });

  document.getElementById('btn-close-admin-profile')?.addEventListener('click', closeAdminProfileModal);
  document.getElementById('btn-cancel-admin-profile')?.addEventListener('click', closeAdminProfileModal);
  adminProfileModal?.addEventListener('click', (event) => {
    if (event.target === adminProfileModal) closeAdminProfileModal();
  });

  adminProfileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    apFeedbackMsg?.classList.add('hidden');

    const fullName = (document.getElementById('ap-fullname')?.value || '').trim();
    const phone = (document.getElementById('ap-phone')?.value || '').trim();
    const email = (document.getElementById('ap-email')?.value || '').trim();
    const currentPassword = document.getElementById('ap-current-password')?.value || '';
    const newPassword = document.getElementById('ap-new-password')?.value || '';
    const submitBtn = document.getElementById('btn-submit-admin-profile');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang lưu...';
    }

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          fullName,
          phone,
          email,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (apFeedbackMsg) {
          apFeedbackMsg.textContent = data.error || 'Không thể cập nhật hồ sơ.';
          apFeedbackMsg.className = 'rounded-xl p-3 text-xs font-semibold bg-red-50 text-red-700 border border-red-200';
          apFeedbackMsg.classList.remove('hidden');
        }
        return;
      }

      if (data.token) {
        adminToken = data.token;
        localStorage.setItem('ha_admin_token', adminToken);
        localStorage.setItem('ha_token', adminToken);
      }
      if (data.user) {
        adminUser = data.user;
      }
      syncAdminScreenUI();
      updatePersonalKPIs();
      await loadStaffAndOrders();

      if (apFeedbackMsg) {
        apFeedbackMsg.textContent = data.message || 'Đã cập nhật hồ sơ nhân sự thành công!';
        apFeedbackMsg.className = 'rounded-xl p-3 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200';
        apFeedbackMsg.classList.remove('hidden');
      }
      document.getElementById('ap-current-password').value = '';
      document.getElementById('ap-new-password').value = '';
    } catch (err) {
      if (apFeedbackMsg) {
        apFeedbackMsg.textContent = 'Lỗi kết nối máy chủ: ' + err.message;
        apFeedbackMsg.className = 'rounded-xl p-3 text-xs font-semibold bg-red-50 text-red-700 border border-red-200';
        apFeedbackMsg.classList.remove('hidden');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Lưu Thay Đổi Hồ Sơ';
      }
    }
  });

  document.getElementById('btn-close-quick-order-modal')?.addEventListener('click', closeQuickOrderModal);
  document.getElementById('btn-cancel-quick-order')?.addEventListener('click', closeQuickOrderModal);
  quickOrderModal?.addEventListener('click', (event) => {
    if (event.target === quickOrderModal) closeQuickOrderModal();
  });

  quickOrderForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    qoErrorMsg?.classList.add('hidden');

    const customerName = (document.getElementById('qo-customer-name')?.value || '').trim();
    const phone = (document.getElementById('qo-phone')?.value || '').trim();
    const email = (document.getElementById('qo-email')?.value || '').trim();
    const planId = document.getElementById('qo-plan')?.value || 'pro';
    const billingCycleMonths = Number(document.getElementById('qo-cycle')?.value) || 12;
    const domainName = (document.getElementById('qo-domain')?.value || '').trim().toLowerCase();
    const couponCode = (document.getElementById('qo-coupon')?.value || '').trim().toUpperCase();
    const notes = (document.getElementById('qo-notes')?.value || '').trim();

    if (!customerName || !phone) {
      if (qoErrorMsg) {
        qoErrorMsg.textContent = 'Vui lòng nhập đầy đủ Họ tên và Số điện thoại của khách hàng.';
        qoErrorMsg.classList.remove('hidden');
      }
      return;
    }

    if (!/^(0|\+84)\d{9}$/.test(phone.replace(/\s+/g, ''))) {
      if (qoErrorMsg) {
        qoErrorMsg.textContent = 'Số điện thoại khách hàng không hợp lệ (cần đủ 10 chữ số, ví dụ 0912345678).';
        qoErrorMsg.classList.remove('hidden');
      }
      return;
    }

    const submitBtn = document.getElementById('btn-submit-quick-order');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang khởi tạo đơn...';
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          customerName,
          phone: phone.replace(/\s+/g, ''),
          email,
          planId,
          billingCycleMonths,
          domainName,
          couponCode,
          notes: notes || 'Đơn tạo hộ khách qua điện thoại (POS Telesale)',
          createdByStaff: true
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.order) {
        if (qoErrorMsg) {
          qoErrorMsg.textContent = data.error || 'Không thể tạo đơn hàng.';
          qoErrorMsg.classList.remove('hidden');
        }
        return;
      }

      closeQuickOrderModal();
      await loadStaffAndOrders();
      openOrderDetailModal(data.order.id);
    } catch (err) {
      if (qoErrorMsg) {
        qoErrorMsg.textContent = 'Lỗi kết nối máy chủ: ' + err.message;
        qoErrorMsg.classList.remove('hidden');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Tạo Đơn & Lấy Mã VietQR';
      }
    }
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

  async function handleStaffActionClick(event) {
    const resetBtn = event.target.closest('.btn-reset-staff-pass');
    if (resetBtn) {
      const userId = resetBtn.getAttribute('data-reset-staff-id');
      const uname = resetBtn.getAttribute('data-reset-staff-username') || 'nhân sự';
      if (!userId) return;
      const newPassword = prompt(`Nhập mật khẩu mới (tối thiểu 6 ký tự) cấp lại cho tài khoản @${uname}:`, '');
      if (newPassword === null) return;
      if (String(newPassword).trim().length < 6) {
        alert('Mật khẩu mới phải có tối thiểu 6 ký tự.');
        return;
      }
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ newPassword: String(newPassword).trim() })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          alert(data.error || 'Không thể cấp lại mật khẩu.');
          return;
        }
        alert(data.message || `Đã cấp lại mật khẩu mới cho @${uname} thành công!`);
      } catch (err) {
        alert('Lỗi kết nối khi cấp lại mật khẩu: ' + err.message);
      }
      return;
    }

    const delBtn = event.target.closest('.btn-delete-staff');
    if (!delBtn) return;
    const userId = delBtn.getAttribute('data-delete-staff-id');
    const uname = delBtn.getAttribute('data-delete-staff-username') || userId;
    if (!userId) return;
    if (!confirm(`Xác nhận thu hồi và xóa tài khoản @${uname}?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) {
        await loadStaffAndOrders();
      }
    } catch (err) {
      console.error('Lỗi xóa tài khoản:', err);
    }
  }

  staffListContainer?.addEventListener('click', handleStaffActionClick);
  document.getElementById('admin-staff-leaderboard-tbody')?.addEventListener('click', handleStaffActionClick);
  document.getElementById('admin-customers-tbody')?.addEventListener('click', handleStaffActionClick);

  document.getElementById('admin-domains-list')?.addEventListener('click', async (event) => {
    const saveDomainBtn = event.target.closest('.btn-save-domain');
    if (!saveDomainBtn) return;
    const ext = saveDomainBtn.getAttribute('data-save-domain-ext');
    if (!ext) return;

    const priceInput = document.querySelector(`[data-domain-price-input="${ext}"]`);
    const price = Number(priceInput?.value || 0);
    const msgEl = document.getElementById('admin-domain-save-msg');

    saveDomainBtn.disabled = true;
    const oldText = saveDomainBtn.textContent;
    saveDomainBtn.textContent = 'Đang lưu...';

    try {
      const res = await fetch('/api/admin/domains', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ extension: ext, price })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || 'Không thể cập nhật bảng giá tên miền.');
        return;
      }
      if (Array.isArray(data.domain_pricing)) {
        allDomains = data.domain_pricing;
        renderDomainsManagementList();
      }
      if (msgEl) {
        msgEl.textContent = `Đã cập nhật giá tên miền ${ext} thành công!`;
        msgEl.classList.remove('hidden');
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ: ' + err.message);
    } finally {
      saveDomainBtn.disabled = false;
      saveDomainBtn.textContent = oldText;
    }
  });

  document.getElementById('admin-addons-list')?.addEventListener('click', async (event) => {
    const saveAddonBtn = event.target.closest('.btn-save-addon');
    if (!saveAddonBtn) return;
    const addonId = saveAddonBtn.getAttribute('data-save-addon-id');
    if (!addonId) return;

    const priceInput = document.querySelector(`[data-addon-price-input="${addonId}"]`);
    const price = Number(priceInput?.value || 0);
    const msgEl = document.getElementById('admin-addon-save-msg');

    saveAddonBtn.disabled = true;
    const oldText = saveAddonBtn.textContent;
    saveAddonBtn.textContent = 'Đang lưu...';

    try {
      const res = await fetch(`/api/admin/addons/${encodeURIComponent(addonId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ price })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || 'Không thể cập nhật bảng giá dịch vụ bổ trợ.');
        return;
      }
      if (Array.isArray(data.addons)) {
        allAddons = data.addons;
        renderAddonsManagementList();
      }
      if (msgEl) {
        msgEl.textContent = `Đã cập nhật giá dịch vụ ${data.addon?.name || addonId} thành công!`;
        msgEl.classList.remove('hidden');
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ: ' + err.message);
    } finally {
      saveAddonBtn.disabled = false;
      saveAddonBtn.textContent = oldText;
    }
  });

  document.getElementById('admin-plans-list')?.addEventListener('click', async (event) => {
    const savePlanBtn = event.target.closest('.btn-save-plan');
    if (!savePlanBtn) return;
    const planId = savePlanBtn.getAttribute('data-save-plan-id');
    if (!planId) return;

    const priceInput = document.querySelector(`[data-plan-price-input="${planId}"]`);
    const domainCheckbox = document.querySelector(`[data-plan-domain-checkbox="${planId}"]`);
    const pricePerMonth = Number(priceInput?.value || 0);
    const freeDomain = Boolean(domainCheckbox?.checked);
    const msgEl = document.getElementById('admin-plan-save-msg');

    savePlanBtn.disabled = true;
    const oldText = savePlanBtn.textContent;
    savePlanBtn.textContent = 'Đang lưu...';

    try {
      const res = await fetch(`/api/admin/plans/${encodeURIComponent(planId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ pricePerMonth, freeDomain })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || 'Không thể cập nhật giá gói Hosting.');
        return;
      }
      if (Array.isArray(data.plans)) {
        allPlans = data.plans;
        renderPlansManagementList();
      }
      if (msgEl) {
        msgEl.textContent = `Đã cập nhật giá gói ${data.plan?.name || planId} thành công!`;
        msgEl.classList.remove('hidden');
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ: ' + err.message);
    } finally {
      savePlanBtn.disabled = false;
      savePlanBtn.textContent = oldText;
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
    if (!confirm(`Xác nhận xóa mã giảm giá ${code}?`)) return;

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
    if (!confirm('Xác nhận gỡ bỏ đánh giá này khỏi trang chủ?')) return;

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

  // ============================================================================
  // LEAD MANAGEMENT — Quản lý Khách Hàng Tiềm Năng (RBAC Staff & Quick Actions)
  // ============================================================================

  // Tab switching logic
  function switchAdminTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const shouldHide = btn.dataset.tab === 'system' && adminUser?.role !== 'admin';
      const hiddenClass = shouldHide ? ' hidden' : '';
      if (btn.dataset.tab === tabName) {
        btn.className = 'tab-btn px-4 py-2 text-sm font-semibold rounded-lg transition-colors bg-brand-600 text-white' + hiddenClass;
      } else {
        btn.className = 'tab-btn px-4 py-2 text-sm font-semibold rounded-lg transition-colors text-slate-600 hover:bg-slate-100' + hiddenClass;
      }
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.add('hidden');
    });
    const activePanel = document.getElementById('tab-panel-' + tabName);
    if (activePanel) activePanel.classList.remove('hidden');
    if (tabName === 'leads') {
      loadLeads();
    } else if (tabName === 'system') {
      renderStaffManagementList();
      renderRevenueAnalytics();
      renderCustomersManagementList();
      renderPlansManagementList();
      renderDomainsManagementList();
      renderAddonsManagementList();
    }
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchAdminTab(btn.dataset.tab));
  });

  let currentLeadId = null;

  function getLeadStatusLabel(status) {
    const map = {
      new: 'Mới',
      contacted: 'Đã liên hệ',
      converted: 'Đã chốt đơn',
      lost: 'Không tiếp cận'
    };
    return map[status] || status;
  }

  function getLeadStatusClass(status) {
    const map = {
      new: 'bg-amber-100 text-amber-800 border border-amber-200',
      contacted: 'bg-blue-100 text-blue-800 border border-blue-200',
      converted: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      lost: 'bg-slate-100 text-slate-600 border border-slate-200'
    };
    return map[status] || 'bg-slate-100 text-slate-500';
  }

  function formatSiteType(val) {
    const map = {
      blog: 'Blog / Tin tức',
      'gioi-thieu': 'Giới thiệu doanh nghiệp',
      'ban-hang': 'Shop bán hàng / TMĐT',
      company: 'Giới thiệu doanh nghiệp',
      ecommerce: 'Shop bán hàng / TMĐT',
      webapp: 'Web App / SaaS'
    };
    return map[val] || val;
  }

  function formatTraffic(val) {
    const map = {
      'duoi-1k': 'Dưới 1.000 lượt/tháng',
      '1k-10k': '1.000 – 10.000 lượt/tháng',
      '10k-50k': '10.000 – 50.000 lượt/tháng',
      'tren-50k': 'Trên 50.000 lượt/tháng',
      low: 'Thấp (<1.000)',
      medium: 'Vừa (1K–10K)',
      high: 'Cao (10K–30K)',
      very_high: 'Rất cao (>30K)'
    };
    return map[val] || val;
  }

  async function loadLeads() {
    try {
      const res = await fetch('/api/leads', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (data.ok) {
        allLeads = data.leads || [];
        renderLeadsTable();
        updateLeadKPIs();
      }
    } catch (err) {
      console.error('Load leads error:', err.message);
    }
  }

  function updateLeadKPIs() {
    const total = allLeads.length;
    const newCount = allLeads.filter(l => l.status === 'new').length;
    const contactedCount = allLeads.filter(l => l.status === 'contacted').length;
    const convertedCount = allLeads.filter(l => l.status === 'converted').length;
    const kpiTotal = document.getElementById('lead-kpi-total');
    const kpiNew = document.getElementById('lead-kpi-new');
    const kpiContacted = document.getElementById('lead-kpi-contacted');
    const kpiConverted = document.getElementById('lead-kpi-converted');
    if (kpiTotal) kpiTotal.textContent = String(total);
    if (kpiNew) kpiNew.textContent = String(newCount);
    if (kpiContacted) kpiContacted.textContent = String(contactedCount);
    if (kpiConverted) kpiConverted.textContent = String(convertedCount);
    updatePersonalKPIs();
  }

  function renderLeadsTable() {
    const tbody = document.getElementById('leads-tbody');
    if (!tbody) return;
    const filterStatus = document.getElementById('lead-filter-status')?.value || 'all';
    const filterAssignee = document.getElementById('lead-filter-assignee')?.value || 'all';
    const filtered = allLeads.filter(l => {
      if (filterStatus !== 'all' && l.status !== filterStatus) return false;
      if (filterAssignee === 'mine' && (!adminUser || l.assigned_to !== adminUser.id)) return false;
      if (filterAssignee === 'unassigned' && l.assigned_to) return false;
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400">Chưa có yêu cầu tư vấn nào.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(lead => {
      const statusClass = getLeadStatusClass(lead.status);
      const statusLabel = getLeadStatusLabel(lead.status);
      const createdDate = lead.created_at ? new Date(lead.created_at).toLocaleString('vi-VN') : '';
      const isMine = adminUser && lead.assigned_to === adminUser.id;
      const isUnassigned = !lead.assigned_to;

      // Render cột Người Phụ Trách
      let assigneeHtml = '';
      if (isMine) {
        assigneeHtml = `<span class="inline-block px-2.5 py-0.5 text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200 rounded-full">Bạn phụ trách</span>`;
      } else if (isUnassigned) {
        assigneeHtml = `
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-slate-400">Chưa có</span>
            <button class="btn-quick-claim text-xs font-bold px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md transition-colors" data-lead-id="${lead.id}">
              Nhận
            </button>
          </div>
        `;
      } else {
        assigneeHtml = `<span class="text-xs text-slate-600 font-medium">${escapeHtml(lead.assigned_to_name || 'Đã phân công')}</span>`;
      }

      // Render cột Thao Tác Nhanh
      const quickCallBtn = `<a href="tel:${escapeHtml(lead.phone || '')}" class="px-2.5 py-1 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap">Gọi ${escapeHtml(lead.phone || '')}</a>`;
      const quickContactedBtn = lead.status === 'new'
        ? `<button class="btn-quick-contacted text-xs font-semibold px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors whitespace-nowrap" data-lead-id="${lead.id}">Đã gọi</button>`
        : '';
      const quickConvertBtn = lead.status !== 'converted'
        ? `<button class="btn-quick-convert text-xs font-bold px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors whitespace-nowrap" data-lead-id="${lead.id}">Chốt đơn</button>`
        : `<span class="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Đã tạo đơn</span>`;
      const detailBtn = `<button class="btn-open-lead text-xs font-semibold px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors whitespace-nowrap" data-lead-id="${lead.id}">Chi tiết</button>`;

      return `<tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
        <td class="px-4 py-3">
          <p class="font-semibold text-slate-800">${escapeHtml(lead.customer_name || '')}</p>
          <p class="text-xs text-slate-500">${escapeHtml(lead.phone || '')} ${lead.email ? '/ ' + escapeHtml(lead.email) : ''}</p>
          <p class="text-xs text-slate-400 mt-0.5">${createdDate}</p>
        </td>
        <td class="px-4 py-3 text-xs text-slate-600">
          <p class="font-medium text-slate-700">${formatSiteType(lead.site_type)}</p>
          <p class="text-slate-400">${formatTraffic(lead.traffic)}</p>
          ${lead.budget ? '<p class="text-slate-500">Ngân sách: ' + Number(lead.budget).toLocaleString('vi-VN') + 'đ/tháng</p>' : ''}
          ${lead.desired_domain ? '<p class="text-brand-600 font-mono">Miền: ' + escapeHtml(lead.desired_domain + (lead.preferred_extension || '')) + '</p>' : ''}
        </td>
        <td class="px-4 py-3">
          <p class="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-lg inline-block border border-brand-100">${escapeHtml(lead.recommended_plan || 'Chưa xác định')}</p>
        </td>
        <td class="px-4 py-3">
          <span class="inline-block px-2.5 py-1 rounded-full text-xs font-bold ${statusClass}">${statusLabel}</span>
        </td>
        <td class="px-4 py-3">
          ${assigneeHtml}
        </td>
        <td class="px-4 py-3">
          <div class="flex flex-wrap items-center gap-1.5">
            ${quickCallBtn}
            ${quickContactedBtn}
            ${quickConvertBtn}
            ${detailBtn}
          </div>
        </td>
      </tr>`;
    }).join('');

    // Gán sự kiện cho các nút trong bảng
    tbody.querySelectorAll('.btn-open-lead').forEach(btn => {
      btn.addEventListener('click', () => openLeadModal(btn.dataset.leadId));
    });

    // 1-Click: Nhận lead ngay trên bảng
    tbody.querySelectorAll('.btn-quick-claim').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await quickClaimLead(btn.dataset.leadId);
      });
    });

    // 1-Click: Đánh dấu đã liên hệ ngay trên bảng
    tbody.querySelectorAll('.btn-quick-contacted').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await quickUpdateStatus(btn.dataset.leadId, 'contacted');
      });
    });

    // 1-Click: Chốt đơn hàng ngay trên bảng
    tbody.querySelectorAll('.btn-quick-convert').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await quickConvertToOrder(btn.dataset.leadId);
      });
    });
  }

  // 1-Click API: Nhận lead
  async function quickClaimLead(leadId) {
    try {
      const res = await fetch('/api/leads/' + leadId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'claim', status: 'contacted' })
      });
      const data = await res.json();
      if (data.ok) {
        const idx = allLeads.findIndex(l => l.id === leadId);
        if (idx !== -1) {
          allLeads[idx] = {
            ...allLeads[idx],
            assigned_to: adminUser.id,
            assigned_to_name: adminUser.fullName || adminUser.username,
            status: allLeads[idx].status === 'new' ? 'contacted' : allLeads[idx].status
          };
        }
        renderLeadsTable();
        updateLeadKPIs();
      } else {
        alert(data.error || 'Không thể nhận lead này');
      }
    } catch (err) {
      alert('Lỗi khi nhận lead: ' + err.message);
    }
  }

  // 1-Click API: Cập nhật trạng thái
  async function quickUpdateStatus(leadId, newStatus) {
    try {
      const res = await fetch('/api/leads/' + leadId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.ok) {
        const idx = allLeads.findIndex(l => l.id === leadId);
        if (idx !== -1) {
          allLeads[idx].status = newStatus;
        }
        renderLeadsTable();
        updateLeadKPIs();
      }
    } catch (err) {
      alert('Lỗi cập nhật trạng thái: ' + err.message);
    }
  }

  // 1-Click API: Chốt đơn hàng
  async function quickConvertToOrder(leadId) {
    if (!confirm('Xác nhận chốt đơn và tạo đơn hàng chính thức cho khách hàng này?')) return;
    try {
      const res = await fetch('/api/leads/' + leadId + '/convert-to-order', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (data.ok && data.order) {
        alert(`Chốt đơn thành công! Đơn hàng mới đã được tạo: ${data.order.id} (${data.order.totalAmount ? Number(data.order.totalAmount).toLocaleString('vi-VN') + 'đ' : ''}). Đang chuyển sang tab Đơn Hàng.`);
        const idx = allLeads.findIndex(l => l.id === leadId);
        if (idx !== -1) {
          allLeads[idx].status = 'converted';
        }
        renderLeadsTable();
        updateLeadKPIs();
        await loadStaffAndOrders();
        switchAdminTab('orders');
      } else {
        alert(data.error || 'Lỗi khi chuyển đổi thành đơn hàng');
      }
    } catch (err) {
      alert('Lỗi chốt đơn: ' + err.message);
    }
  }

  function setActiveStatusButton(status) {
    const input = document.getElementById('lead-status-select');
    if (input) input.value = status;
    document.querySelectorAll('.btn-lead-status').forEach(btn => {
      if (btn.dataset.status === status) {
        btn.className = 'btn-lead-status px-2.5 py-2 text-xs font-bold rounded-xl border border-brand-500 bg-brand-600 text-white shadow-sm transition-all';
      } else {
        btn.className = 'btn-lead-status px-2.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all text-slate-700';
      }
    });
  }

  function openLeadModal(leadId) {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) return;
    currentLeadId = leadId;

    const infoEl = document.getElementById('lead-detail-info');
    if (infoEl) {
      infoEl.innerHTML = `
        <div class="bg-slate-50 rounded-xl p-4 space-y-1.5 border border-slate-200">
          <p><span class="font-semibold text-slate-600 w-28 inline-block">Mã Lead:</span> <span class="font-mono text-xs">${escapeHtml(lead.id)}</span></p>
          <p><span class="font-semibold text-slate-600 w-28 inline-block">Họ và tên:</span> <span class="font-bold text-slate-900">${escapeHtml(lead.customer_name)}</span></p>
          <p><span class="font-semibold text-slate-600 w-28 inline-block">Số ĐT:</span> <a href="tel:${escapeHtml(lead.phone)}" class="text-brand-600 font-bold underline">${escapeHtml(lead.phone)}</a></p>
          ${lead.email ? '<p><span class="font-semibold text-slate-600 w-28 inline-block">Email:</span> ' + escapeHtml(lead.email) + '</p>' : ''}
          <p><span class="font-semibold text-slate-600 w-28 inline-block">Loại web:</span> ${formatSiteType(lead.site_type)}</p>
          <p><span class="font-semibold text-slate-600 w-28 inline-block">Lưu lượng:</span> ${formatTraffic(lead.traffic)}</p>
          ${lead.budget ? '<p><span class="font-semibold text-slate-600 w-28 inline-block">Ngân sách:</span> ' + Number(lead.budget).toLocaleString('vi-VN') + 'đ/tháng</p>' : ''}
          ${lead.desired_domain ? '<p><span class="font-semibold text-slate-600 w-28 inline-block">Tên miền:</span> <span class="font-mono text-brand-700 font-semibold">' + escapeHtml(lead.desired_domain + (lead.preferred_extension || '')) + '</span></p>' : ''}
          <p><span class="font-semibold text-slate-600 w-28 inline-block">Gói đề xuất:</span> <span class="text-brand-600 font-bold">${escapeHtml(lead.recommended_plan || 'Chưa xác định')}</span></p>
          ${lead.notes ? '<div class="mt-2 p-2.5 bg-amber-50 rounded-lg border border-amber-200"><p class="text-xs font-semibold text-amber-800 mb-0.5">Nhật ký ghi chú cũ:</p><p class="text-xs text-amber-900">' + escapeHtml(lead.notes) + '</p></div>' : ''}
        </div>
      `;
    }

    // Set status buttons
    setActiveStatusButton(lead.status || 'new');

    // Reset AI script box
    const scriptBox = document.getElementById('lead-ai-script-box');
    if (scriptBox) {
      scriptBox.classList.add('hidden');
      scriptBox.textContent = '';
    }

    // RBAC: Staff vs Admin
    const isAdmin = adminUser && adminUser.role === 'admin';
    const adminAssigneeBox = document.getElementById('lead-assignee-admin-box');
    const staffAssigneeBox = document.getElementById('lead-assignee-staff-box');
    const deleteBtn = document.getElementById('btn-delete-lead');

    if (isAdmin) {
      adminAssigneeBox?.classList.remove('hidden');
      staffAssigneeBox?.classList.add('hidden');
      deleteBtn?.classList.remove('hidden');

      const assigneeSelect = document.getElementById('lead-assignee-select');
      if (assigneeSelect) {
        assigneeSelect.innerHTML = '<option value="">Chưa phân công</option>';
        (staffUsers || []).forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.fullName || s.full_name || s.username;
          if (s.id === lead.assigned_to) opt.selected = true;
          assigneeSelect.appendChild(opt);
        });
      }
    } else {
      // Staff mode: Hide assignee dropdown & delete button!
      adminAssigneeBox?.classList.add('hidden');
      staffAssigneeBox?.classList.remove('hidden');
      deleteBtn?.classList.add('hidden');

      const staffAssigneeName = document.getElementById('lead-staff-assignee-name');
      const staffClaimBtn = document.getElementById('btn-staff-claim-lead');
      if (staffAssigneeName) {
        staffAssigneeName.textContent = lead.assigned_to_name || 'Chưa có ai phụ trách';
      }
      if (staffClaimBtn) {
        if (lead.assigned_to === adminUser.id) {
          staffClaimBtn.textContent = 'Bạn đang phụ trách lead này';
          staffClaimBtn.disabled = true;
          staffClaimBtn.className = 'text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200';
        } else if (lead.assigned_to) {
          staffClaimBtn.textContent = 'Đã có người khác phụ trách';
          staffClaimBtn.disabled = true;
          staffClaimBtn.className = 'text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed';
        } else {
          staffClaimBtn.textContent = 'Nhận Chăm Sóc Khách Này';
          staffClaimBtn.disabled = false;
          staffClaimBtn.className = 'bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors';
        }
      }
    }

    const notesInput = document.getElementById('lead-notes-input');
    if (notesInput) notesInput.value = lead.notes || '';

    const saveMsg = document.getElementById('lead-save-msg');
    if (saveMsg) saveMsg.classList.add('hidden');

    const modal = document.getElementById('lead-detail-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function closeLeadModal() {
    const modal = document.getElementById('lead-detail-modal');
    if (modal) modal.classList.add('hidden');
    currentLeadId = null;
  }

  // Lưu cập nhật từ Modal
  async function saveLeadUpdate() {
    if (!currentLeadId) return;
    const statusVal = document.getElementById('lead-status-select')?.value || 'new';
    const notesVal = document.getElementById('lead-notes-input')?.value || '';
    const saveMsg = document.getElementById('lead-save-msg');
    const saveBtn = document.getElementById('btn-save-lead');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Đang lưu...'; }

    const payload = { status: statusVal, notes: notesVal };
    if (adminUser && adminUser.role === 'admin') {
      const assigneeEl = document.getElementById('lead-assignee-select');
      payload.assignedTo = assigneeEl?.value || '';
      payload.assignedToName = assigneeEl?.options[assigneeEl.selectedIndex]?.textContent || 'Chưa phân công';
    }

    try {
      const res = await fetch('/api/leads/' + currentLeadId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.ok) {
        const idx = allLeads.findIndex(l => l.id === currentLeadId);
        if (idx !== -1) {
          allLeads[idx] = { ...allLeads[idx], ...data.lead };
        }
        renderLeadsTable();
        updateLeadKPIs();
        if (saveMsg) { saveMsg.textContent = 'Đã lưu cập nhật thành công.'; saveMsg.className = 'text-xs text-emerald-600 mt-1 font-semibold'; saveMsg.classList.remove('hidden'); }
        setTimeout(() => closeLeadModal(), 800);
      } else {
        throw new Error(data.error || 'Lỗi hệ thống');
      }
    } catch (err) {
      if (saveMsg) { saveMsg.textContent = 'Lỗi: ' + err.message; saveMsg.className = 'text-xs text-red-600 mt-1'; saveMsg.classList.remove('hidden'); }
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Lưu Cập Nhật'; }
    }
  }

  // Xóa lead (Admin Only)
  async function deleteLead() {
    if (!currentLeadId) return;
    if (adminUser && adminUser.role !== 'admin') {
      alert('Chỉ Quản trị viên (Admin) mới có quyền xóa lead.');
      return;
    }
    if (!confirm('Xác nhận xóa yêu cầu tư vấn này khỏi hệ thống?')) return;
    try {
      const res = await fetch('/api/leads/' + currentLeadId, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (data.ok) {
        allLeads = allLeads.filter(l => l.id !== currentLeadId);
        renderLeadsTable();
        updateLeadKPIs();
        closeLeadModal();
      }
    } catch (err) {
      alert('Lỗi xóa lead: ' + err.message);
    }
  }

  // AI Soạn Kịch Bản Telesale cho Lead
  async function generateLeadSalesScript() {
    if (!currentLeadId) return;
    const btn = document.getElementById('btn-lead-ai-script');
    const box = document.getElementById('lead-ai-script-box');
    if (btn) { btn.disabled = true; btn.textContent = 'AI đang soạn...'; }
    if (box) { box.classList.remove('hidden'); box.textContent = 'Đang kết nối Gemini AI để tạo kịch bản 3 bước...'; }

    try {
      const res = await fetch('/api/advice/sales-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ leadId: currentLeadId })
      });
      const data = await res.json();
      if (data.ok && data.script) {
        if (box) box.textContent = data.script;
      } else {
        if (box) box.textContent = 'Không thể tạo kịch bản AI: ' + (data.error || 'Lỗi mạng');
      }
    } catch (err) {
      if (box) box.textContent = 'Lỗi kết nối: ' + err.message;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'AI Soạn Lại'; }
    }
  }

  // Gan su kien modal
  document.getElementById('btn-close-lead-modal')?.addEventListener('click', closeLeadModal);
  document.getElementById('btn-save-lead')?.addEventListener('click', saveLeadUpdate);
  document.getElementById('btn-delete-lead')?.addEventListener('click', deleteLead);
  document.getElementById('btn-refresh-leads')?.addEventListener('click', loadLeads);
  document.getElementById('lead-filter-status')?.addEventListener('change', renderLeadsTable);
  document.getElementById('lead-filter-assignee')?.addEventListener('change', renderLeadsTable);
  document.getElementById('btn-lead-ai-script')?.addEventListener('click', generateLeadSalesScript);
  document.getElementById('btn-lead-convert-order')?.addEventListener('click', async () => {
    if (currentLeadId) {
      await quickConvertToOrder(currentLeadId);
      closeLeadModal();
    }
  });

  // Staff claim lead button inside modal
  document.getElementById('btn-staff-claim-lead')?.addEventListener('click', async () => {
    if (currentLeadId) {
      await quickClaimLead(currentLeadId);
      openLeadModal(currentLeadId); // refresh modal view
    }
  });

  // Quick status selector buttons
  document.querySelectorAll('.btn-lead-status').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveStatusButton(btn.dataset.status);
    });
  });

  document.getElementById('lead-detail-modal')?.addEventListener('click', function(e) {
    if (e.target === this) closeLeadModal();
  });

});
