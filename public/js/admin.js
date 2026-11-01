/**
 * public/js/admin.js — HỆ THỐNG QUẢN TRỊ ĐƠN HÀNG THƯƠNG MẠI ĐIỆN TỬ (ADMIN OMS PORTAL)
 *
 * Chức năng hoàn chỉnh:
 * 1. Xác thực phân quyền RBAC (Admin toàn quyền, Staff chỉ xem và xử lý đơn)
 * 2. Tính toán 4 chỉ số KPI doanh thu thời gian thực (updateKPIs)
 * 3. Bảng quản lý đơn hàng đa chiều & bộ lọc tìm kiếm (getFilteredOrders, renderOrdersTable)
 * 4. Modal chi tiết đơn hàng: đối soát VietQR, duyệt tiền & cấp phát IP Hosting tự động (openOrderDetailModal)
 * 5. Trợ lý Gemini AI soạn kịch bản Telesale 3 bước chốt đơn
 * 6. Xuất báo cáo tài chính CSV chuẩn UTF-8 BOM
 * 7. Quản lý nhân sự Staff (tạo/xóa tài khoản)
 * 8. Quản lý mã giảm giá Coupon (tạo/xóa mã khuyến mại)
 * 9. Cấu hình ngân hàng VietQR động & kiểm tra live QR
 * 10. Kiểm duyệt và xóa đánh giá khách hàng spam (Reviews)
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
// 1. XÁC THỰC PHÂN QUYỀN RBAC (ADMIN & STAFF)
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

    // Chỉ Admin mới được hiển thị khu vực Quản trị Hệ thống
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
    if (!res.ok) throw new Error('Phiên làm việc hết hạn');
    const data = await res.json();
    if (!data.user || (data.user.role !== 'admin' && data.user.role !== 'staff')) {
      throw new Error('Tài khoản không có quyền truy cập Cổng Quản Trị');
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
    const fetchPromises = [
      fetch('/api/users/staff', { headers: { Authorization: `Bearer ${adminToken}` } }),
      fetch('/api/orders', { headers: { Authorization: `Bearer ${adminToken}` } }),
      fetch('/api/catalog')
    ];

    if (adminUser && adminUser.role === 'admin') {
      fetchPromises.push(
        fetch('/api/admin/coupons', { headers: { Authorization: `Bearer ${adminToken}` } }),
        fetch('/api/reviews')
      );
    }

    const [staffRes, ordersRes, catalogRes, couponsRes, reviewsRes] = await Promise.all(fetchPromises);

    if (staffRes && staffRes.ok) {
      const sData = await staffRes.json();
      staffUsers = sData.staff || [];
      populateAssigneeDropdowns();
      if (adminUser?.role === 'admin') renderStaffList();
    }

    if (ordersRes && ordersRes.ok) {
      const oData = await ordersRes.json();
      allOrders = oData.orders || [];
      updateKPIs();
      renderOrdersTable();
    }

    if (catalogRes && catalogRes.ok) {
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

    if (couponsRes && couponsRes.ok) {
      const cpData = await couponsRes.json();
      allCoupons = cpData.coupons || [];
      if (adminUser?.role === 'admin') renderCouponList();
    }

    if (reviewsRes && reviewsRes.ok) {
      const rvData = await reviewsRes.json();
      allReviews = rvData.reviews || [];
      if (adminUser?.role === 'admin') renderAdminReviewsList();
    }
  } catch (err) {
    console.error('[Admin] Lỗi tải dữ liệu:', err);
  }
}

function populateAssigneeDropdowns() {
  const filterAssignee = document.getElementById('filter-assignee');
  const detailAssignee = document.getElementById('detail-assignee-select');

  if (filterAssignee) {
    const currentVal = filterAssignee.value || 'all';
    filterAssignee.innerHTML = `
      <option value="all">Tất cả người phụ trách</option>
      <option value="unassigned">Chưa phân công</option>
      ${staffUsers
        .map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.fullName)} (${escapeHtml(s.username)})</option>`)
        .join('')}
    `;
    filterAssignee.value = currentVal;
  }

  if (detailAssignee) {
    detailAssignee.innerHTML = `
      <option value="">Chưa phân công</option>
      ${staffUsers
        .map(
          (s) =>
            `<option value="${escapeHtml(s.id)}">${escapeHtml(s.fullName)} (${escapeHtml(s.username)} - ${escapeHtml(
              s.role.toUpperCase()
            )})</option>`
        )
        .join('')}
    `;
    if (adminUser && adminUser.role !== 'admin') {
      detailAssignee.disabled = true;
    } else {
      detailAssignee.disabled = false;
    }
  }
}

// =========================================================
// 2. TÍNH TOÁN 4 CHỈ SỐ KPI DOANH THU THỜI GIAN THỰC
// =========================================================

function updateKPIs() {
  let paidRevenue = 0;      // Doanh thu thực nhận (các đơn đã thanh toán)
  let pendingRevenue = 0;   // Doanh thu chờ duyệt (các đơn chờ duyệt tiền hoặc chờ thanh toán)
  let pendingCount = 0;     // Số lượng đơn cần duyệt tiền

  for (const o of allOrders) {
    const amt = Number(o.totalAmount) || 0;
    if (o.status === 'completed' || o.paymentStatus === 'paid') {
      paidRevenue += amt;
    } else if (o.status === 'paid_processing' || o.status === 'pending_payment') {
      pendingRevenue += amt;
      pendingCount += 1;
    }
  }

  const elPaid = document.getElementById('kpi-paid-revenue');
  const elPending = document.getElementById('kpi-pending-revenue');
  const elCount = document.getElementById('kpi-pending-count');
  const elTotal = document.getElementById('kpi-total-orders');

  if (elPaid) elPaid.textContent = formatVND(paidRevenue);
  if (elPending) elPending.textContent = formatVND(pendingRevenue);
  if (elCount) elCount.textContent = String(pendingCount);
  if (elTotal) elTotal.textContent = String(allOrders.length);
}

// =========================================================
// 3. BẢNG QUẢN LÝ ĐƠN HÀNG OMS & BỘ LỌC TÌM KIẾM ĐA CHIỀU
// =========================================================

function getFilteredOrders() {
  const searchVal = (document.getElementById('filter-search')?.value || '').trim().toLowerCase();
  const statusVal = document.getElementById('filter-status')?.value || 'all';
  const assigneeVal = document.getElementById('filter-assignee')?.value || 'all';

  return allOrders.filter((o) => {
    // 1. Lọc theo trạng thái
    if (statusVal !== 'all' && o.status !== statusVal) return false;

    // 2. Lọc theo người phụ trách
    if (assigneeVal === 'unassigned' && o.assignedTo) return false;
    if (assigneeVal !== 'all' && assigneeVal !== 'unassigned' && o.assignedTo !== assigneeVal) return false;

    // 3. Lọc theo từ khóa tìm kiếm
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
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(searchVal)) return false;
    }
    return true;
  });
}

function renderOrdersTable() {
  const tbody = document.getElementById('admin-orders-tbody');
  const summaryEl = document.getElementById('admin-filter-summary');
  if (!tbody) return;

  const filtered = getFilteredOrders();

  if (summaryEl) {
    summaryEl.textContent = `Hiển thị ${filtered.length} / ${allOrders.length} đơn hàng trên hệ thống. Bấm vào nút "Chi tiết & Duyệt" để thao tác.`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-xs text-slate-500">
          Không tìm thấy đơn hàng nào phù hợp với bộ lọc hiện tại.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map((o) => {
      let statusBadge = '';
      if (o.status === 'completed' || o.paymentStatus === 'paid') {
        statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Đã kích hoạt (Paid)</span>';
      } else if (o.status === 'paid_processing') {
        statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Chờ duyệt tiền (Đã CK)</span>';
      } else if (o.status === 'pending_payment') {
        statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Chờ thanh toán</span>';
      } else if (o.status === 'cancelled') {
        statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">Đã hủy</span>';
      } else {
        statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">${escapeHtml(o.status)}</span>`;
      }

      const addonsText = Array.isArray(o.addons) && o.addons.length > 0
        ? o.addons.map((a) => a.name).join(', ')
        : 'Không add-on';

      const couponBadge = o.couponApplied
        ? `<div class="mt-0.5 text-xs text-emerald-700 font-medium">Coupon: <span class="font-mono font-bold">${escapeHtml(o.couponApplied)}</span> (-${formatVND(o.discountAmount)})</div>`
        : '';

      const deleteBtn = adminUser?.role === 'admin'
        ? `<button type="button" class="btn-delete-order py-1 px-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200 transition-colors" data-order-id="${escapeHtml(o.id)}">Xóa</button>`
        : '';

      const formattedDate = o.createdAt
        ? new Date(o.createdAt).toLocaleString('vi-VN', { hour12: false })
        : 'N/A';

      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="p-3.5">
            <div class="font-mono font-bold text-brand-700">${escapeHtml(o.id)}</div>
            <div class="text-xs text-slate-400 mt-0.5">${escapeHtml(formattedDate)}</div>
          </td>
          <td class="p-3.5">
            <div class="font-semibold text-slate-900">${escapeHtml(o.customerName)}</div>
            <div class="text-xs text-slate-500 font-mono mt-0.5">${escapeHtml(o.phone)}</div>
            ${o.email ? `<div class="text-xs text-slate-400">${escapeHtml(o.email)}</div>` : ''}
          </td>
          <td class="p-3.5">
            <div class="font-medium text-slate-800">Gói ${escapeHtml(o.planName)} (${o.billingCycleMonths}T)</div>
            <div class="text-xs text-brand-600 font-mono mt-0.5">${escapeHtml(o.domainName || 'Không kèm tên miền')}</div>
          </td>
          <td class="p-3.5 max-w-[200px]">
            <div class="text-xs text-slate-600 truncate" title="${escapeHtml(addonsText)}">${escapeHtml(addonsText)}</div>
            ${couponBadge}
          </td>
          <td class="p-3.5 font-extrabold text-slate-900 whitespace-nowrap">
            ${formatVND(o.totalAmount)}
          </td>
          <td class="p-3.5 whitespace-nowrap">
            ${statusBadge}
          </td>
          <td class="p-3.5 text-xs text-slate-600 whitespace-nowrap">
            <div class="font-medium text-slate-800">${escapeHtml(o.assignedToName || 'Chưa phân công')}</div>
          </td>
          <td class="p-3.5 text-right whitespace-nowrap space-x-1.5">
            <button
              type="button"
              class="btn-open-detail py-1.5 px-3 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold border border-brand-200 transition-colors"
              data-order-id="${escapeHtml(o.id)}"
            >
              Chi tiết &amp; Duyệt
            </button>
            ${deleteBtn}
          </td>
        </tr>
      `;
    })
    .join('');

  // Gắn sự kiện cho các nút mở chi tiết và xóa
  tbody.querySelectorAll('.btn-open-detail').forEach((btn) => {
    btn.addEventListener('click', () => {
      const orderId = btn.getAttribute('data-order-id');
      if (orderId) openOrderDetailModal(orderId);
    });
  });

  tbody.querySelectorAll('.btn-delete-order').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const orderId = btn.getAttribute('data-order-id');
      if (!orderId) return;
      if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn đơn hàng ${orderId} khỏi CSDL?`)) return;
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          allOrders = allOrders.filter((x) => x.id !== orderId);
          updateKPIs();
          renderOrdersTable();
          alert(`Đã xóa đơn hàng ${orderId} thành công.`);
        } else {
          alert('Lỗi xóa đơn: ' + (data.error || 'Không thể xóa'));
        }
      } catch (err) {
        alert('Lỗi kết nối máy chủ: ' + err.message);
      }
    });
  });
}

// =========================================================
// 4. MODAL CHI TIẾT ĐƠN, ĐỐI SOÁT VIETQR & CẤP PHÁT IP HOSTING
// =========================================================

function openOrderDetailModal(orderId) {
  const order = allOrders.find((o) => o.id === orderId);
  if (!order) return;
  activeOrder = order;

  const modal = document.getElementById('order-detail-modal');
  const orderIdEl = document.getElementById('detail-order-id');
  const summaryBox = document.getElementById('detail-summary-box');
  const paymentStatusText = document.getElementById('detail-payment-status-text');
  const approveBtn = document.getElementById('btn-approve-payment');
  const statusSelect = document.getElementById('detail-status-select');
  const assigneeSelect = document.getElementById('detail-assignee-select');
  const notesInput = document.getElementById('detail-notes-input');
  const timelineList = document.getElementById('detail-timeline-list');
  const salesScriptBox = document.getElementById('detail-sales-script-box');
  const qrImg = document.getElementById('detail-qr-img');
  const qrAmount = document.getElementById('detail-qr-amount');
  const saveMsg = document.getElementById('detail-save-msg');

  if (saveMsg) saveMsg.classList.add('hidden');

  if (orderIdEl) orderIdEl.textContent = order.id;

  // Hiển thị tóm tắt thông tin đơn hàng
  const addonsDetail = Array.isArray(order.addons) && order.addons.length > 0
    ? order.addons.map((a) => `${escapeHtml(a.name)} (${formatVND(a.price)})`).join(', ')
    : 'Không có';

  let serviceDetailsHtml = '';
  if (order.serviceDetails && order.serviceDetails.hostingIp) {
    serviceDetailsHtml = `
      <div class="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
        <div class="font-bold text-emerald-800">Thông số kỹ thuật Hosting đã cấp phát:</div>
        <div>IP máy chủ: <code class="font-bold font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-300">${escapeHtml(order.serviceDetails.hostingIp)}</code></div>
        <div>Hệ thống NameServers: <span class="font-mono">${Array.isArray(order.serviceDetails.nameServers) ? order.serviceDetails.nameServers.join(' / ') : 'ns1.hostingadvisor.vn / ns2.hostingadvisor.vn'}</span></div>
        <div>Control Panel: <a href="${escapeHtml(order.serviceDetails.controlPanelUrl || 'https://cp.hostingadvisor.vn:2083')}" target="_blank" class="underline text-brand-700">${escapeHtml(order.serviceDetails.controlPanelUrl || 'https://cp.hostingadvisor.vn:2083')}</a></div>
      </div>
    `;
  }

  if (summaryBox) {
    summaryBox.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2 border-b border-slate-200">
        <div><strong>Khách hàng:</strong> ${escapeHtml(order.customerName)}</div>
        <div><strong>Điện thoại:</strong> <span class="font-mono font-semibold">${escapeHtml(order.phone)}</span></div>
        <div><strong>Email:</strong> ${escapeHtml(order.email || 'Chưa cung cấp')}</div>
        <div><strong>Ngày tạo đơn:</strong> ${order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN') : 'N/A'}</div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 pb-2 border-b border-slate-200">
        <div><strong>Gói cước:</strong> ${escapeHtml(order.planName)} (${order.billingCycleMonths} tháng) — ${formatVND(order.hostingAmount)}</div>
        <div><strong>Tên miền:</strong> <span class="font-mono font-semibold text-brand-700">${escapeHtml(order.domainName || 'Không đăng ký')}</span> ${order.domainAmount ? '(' + formatVND(order.domainAmount) + ')' : ''}</div>
        <div class="sm:col-span-2"><strong>Dịch vụ cộng thêm:</strong> ${addonsDetail}</div>
        <div><strong>Mã giảm giá:</strong> ${order.couponApplied ? `<span class="font-mono font-bold text-emerald-700">${escapeHtml(order.couponApplied)}</span> (-${formatVND(order.discountAmount)})` : 'Không có'}</div>
        <div><strong>Tổng tiền thanh toán:</strong> <span class="font-extrabold text-base text-brand-700">${formatVND(order.totalAmount)}</span></div>
      </div>
      ${serviceDetailsHtml}
    `;
  }

  // Khu vực Duyệt Thanh Toán & Kích Hoạt
  const isPaid = order.status === 'completed' || order.paymentStatus === 'paid';
  if (paymentStatusText) {
    paymentStatusText.textContent = isPaid
      ? 'Đơn hàng này đã được xác nhận thanh toán và cấp phát dịch vụ thành công.'
      : 'Khách hàng chưa thanh toán hoặc đang chờ kế toán đối soát giao dịch VietQR.';
  }

  if (approveBtn) {
    if (isPaid) {
      approveBtn.disabled = true;
      approveBtn.textContent = 'Đơn Hàng Đã Kích Hoạt';
      approveBtn.className = 'shrink-0 py-2.5 px-4 rounded-xl bg-slate-200 text-slate-500 text-xs sm:text-sm font-bold cursor-not-allowed';
    } else {
      approveBtn.disabled = false;
      approveBtn.textContent = 'Xác Nhận Đã Nhận Tiền & Kích Hoạt Dịch Vụ';
      approveBtn.className = 'shrink-0 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm transition-all';
    }
  }

  // Điền form cập nhật trạng thái & phân công
  if (statusSelect) statusSelect.value = order.status;
  if (assigneeSelect) assigneeSelect.value = order.assignedTo || '';
  if (notesInput) notesInput.value = order.notes || '';

  // Render Timeline
  renderOrderTimeline(order.timeline);

  // Hiển thị ảnh mã VietQR để đối soát
  const bId = bankSettings.bankId || 'MB';
  const aNo = bankSettings.accountNo || '0988123456';
  const aName = bankSettings.accountName || 'CONG TY TNHH HOSTING ADVISOR';
  const qrUrl = order.qrUrl || `https://img.vietqr.io/image/${encodeURIComponent(bId)}-${encodeURIComponent(aNo)}-compact2.png?amount=${encodeURIComponent(order.totalAmount || 0)}&addInfo=${encodeURIComponent(order.id)}&accountName=${encodeURIComponent(aName)}`;

  if (qrImg) qrImg.src = qrUrl;
  if (qrAmount) qrAmount.textContent = `Số tiền: ${formatVND(order.totalAmount)} | Nội dung CK: ${order.id}`;

  // Đặt lại khung Telesale Script
  if (salesScriptBox) {
    salesScriptBox.textContent = 'Bấm nút "AI Soạn Kịch Bản Gọi Điện" ở trên để tạo kịch bản tư vấn cho khách hàng này.';
  }

  modal?.classList.remove('hidden');
}

function renderOrderTimeline(timeline) {
  const container = document.getElementById('detail-timeline-list');
  if (!container) return;

  if (!Array.isArray(timeline) || timeline.length === 0) {
    container.innerHTML = '<div class="text-xs text-slate-400 italic">Chưa có nhật ký ghi vết nào cho đơn hàng này.</div>';
    return;
  }

  container.innerHTML = timeline
    .slice()
    .reverse()
    .map((item) => {
      const timeFormatted = item.time ? new Date(item.time).toLocaleString('vi-VN') : 'Vừa xong';
      return `
        <div class="flex items-start gap-2.5 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <div class="w-2 h-2 rounded-full bg-brand-600 mt-1.5 shrink-0"></div>
          <div class="flex-1">
            <div class="font-semibold text-slate-800">${escapeHtml(item.action)}</div>
            <div class="text-[11px] text-slate-500 mt-0.5">${escapeHtml(timeFormatted)} — Bởi: <span class="font-medium text-slate-700">${escapeHtml(item.by || 'Hệ thống')}</span></div>
          </div>
        </div>
      `;
    })
    .join('');
}

// =========================================================
// 5. TRỢ LÝ GEMINI AI SOẠN KỊCH BẢN TELESALE 3 BƯỚC
// =========================================================

async function generateSalesScript() {
  if (!activeOrder) return;
  const scriptBox = document.getElementById('detail-sales-script-box');
  const generateBtn = document.getElementById('btn-generate-sales-script');

  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.textContent = 'AI đang soạn kịch bản...';
  }
  if (scriptBox) {
    scriptBox.textContent = 'Đang kết nối Gemini AI để phân tích cấu hình gói và tạo kịch bản telesale 3 bước chuyên nghiệp...';
  }

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
    if (res.ok && data.ok) {
      if (scriptBox) scriptBox.textContent = data.script || 'Không nhận được kịch bản từ AI.';
    } else {
      if (scriptBox) scriptBox.textContent = 'Lỗi tạo kịch bản: ' + (data.error || 'Vui lòng thử lại sau.');
    }
  } catch (err) {
    if (scriptBox) scriptBox.textContent = 'Lỗi kết nối máy chủ: ' + err.message;
  } finally {
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = 'AI Soạn Kịch Bản Gọi Điện';
    }
  }
}

// =========================================================
// 6. XUẤT BÁO CÁO TÀI CHÍNH EXCEL BẢNG TÍNH & CSV CHUẨN
// =========================================================

function exportOrdersToExcel() {
  const rowsData = getFilteredOrders();
  if (rowsData.length === 0) {
    alert('Không có đơn hàng nào phù hợp để xuất báo cáo.');
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
    'Tiền Giảm (VNĐ)',
    'Tổng Thanh Toán (VNĐ)',
    'Trạng Thái TT',
    'Trạng Thái Đơn',
    'Phụ Trách'
  ];

  const rows = rowsData.map((o) => {
    const addonsStr = Array.isArray(o.addons) && o.addons.length > 0
      ? o.addons.map((a) => a.name).join(' + ')
      : 'Không có';
    const dateStr = o.createdAt
      ? new Date(o.createdAt).toLocaleString('vi-VN', { hour12: false })
      : '';

    return [
      o.id,
      dateStr,
      o.customerName,
      o.phone || '',
      o.email || '',
      o.planName,
      Number(o.billingCycleMonths) || 12,
      o.domainName || 'Không kèm tên miền',
      addonsStr,
      o.couponApplied || '',
      Number(o.discountAmount) || 0,
      Number(o.totalAmount) || 0,
      o.paymentStatus || 'unpaid',
      o.status || 'pending_payment',
      o.assignedToName || 'Chưa phân công'
    ];
  });

  // Nếu đã nạp thư viện XLSX, xuất file bảng tính .xlsx chuẩn để mở ra từng cột riêng biệt
  if (typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Tự động căn chỉnh độ rộng cột chuẩn bảng tính
    const colWidths = headers.map((h, i) => {
      let maxLen = h.length;
      for (const r of rows) {
        const val = r[i] !== undefined && r[i] !== null ? String(r[i]) : '';
        if (val.length > maxLen) maxLen = val.length;
      }
      return { wch: Math.min(Math.max(maxLen + 3, 14), 45) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Báo Cáo Đơn Hàng');

    const fileName = `bao-cao-don-hang-oms-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  } else {
    exportOrdersToCSV();
  }
}

function exportOrdersToCSV() {
  const rowsData = getFilteredOrders();
  if (rowsData.length === 0) {
    alert('Không có đơn hàng nào phù hợp để xuất báo cáo.');
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
    'Trạng Thái TT',
    'Trạng Thái Đơn',
    'Phụ Trách'
  ];

  const rows = rowsData.map((o) => {
    const addonsStr = Array.isArray(o.addons) ? o.addons.map((a) => a.name).join(' + ') : '';
    const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleString('vi-VN') : '';
    return [
      o.id,
      dateStr,
      o.customerName,
      o.phone,
      o.email || '',
      o.planName,
      o.billingCycleMonths,
      o.domainName || '',
      addonsStr,
      o.couponApplied || '',
      o.discountAmount || 0,
      o.totalAmount || 0,
      o.paymentStatus,
      o.status,
      o.assignedToName || 'Chưa phân công'
    ].map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`);
  });

  // sep=, directive để Excel trên mọi máy Windows tự động phân cột chuẩn xác
  const csvContent = '\uFEFFsep=,\r\n' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
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
// 7. QUẢN TRỊ HỆ THỐNG DÀNH CHO ADMIN (PANEL 1-4)
// =========================================================

// Panel 1: Quản lý nhân sự Staff
function renderStaffList() {
  const container = document.getElementById('staff-list-container');
  if (!container) return;

  if (staffUsers.length === 0) {
    container.innerHTML = '<div class="text-xs text-slate-400 italic">Chưa có nhân sự nào trong danh sách.</div>';
    return;
  }

  container.innerHTML = staffUsers
    .map((s) => {
      const isSelf = s.id === adminUser?.id;
      const deleteBtn = !isSelf && adminUser?.role === 'admin'
        ? `<button type="button" class="btn-delete-staff text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1 rounded bg-red-50 hover:bg-red-100 transition-colors" data-user-id="${escapeHtml(s.id)}">Xóa</button>`
        : '';

      const roleBadge = s.role === 'admin'
        ? '<span class="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Admin</span>'
        : '<span class="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">Staff</span>';

      return `
        <div class="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50">
          <div>
            <div class="font-semibold text-slate-800 flex items-center gap-1.5">
              ${escapeHtml(s.fullName)} ${roleBadge}
            </div>
            <div class="text-[11px] text-slate-500 font-mono">
              Username: ${escapeHtml(s.username)} ${s.phone ? `• SĐT: ${escapeHtml(s.phone)}` : ''}
            </div>
          </div>
          <div>${deleteBtn}</div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.btn-delete-staff').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const uId = btn.getAttribute('data-user-id');
      if (!uId) return;
      if (!confirm('Bạn có chắc chắn muốn thu hồi tài khoản nhân sự này?')) return;
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(uId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          staffUsers = staffUsers.filter((u) => u.id !== uId);
          populateAssigneeDropdowns();
          renderStaffList();
        } else {
          alert('Lỗi: ' + (data.error || 'Không thể xóa'));
        }
      } catch (err) {
        alert('Lỗi kết nối máy chủ: ' + err.message);
      }
    });
  });
}

// Panel 2: Quản lý mã giảm giá (Coupons)
function renderCouponList() {
  const container = document.getElementById('coupon-list-container');
  if (!container) return;

  if (allCoupons.length === 0) {
    container.innerHTML = '<div class="text-xs text-slate-400 italic">Chưa có mã giảm giá nào đang hoạt động.</div>';
    return;
  }

  container.innerHTML = allCoupons
    .map((c) => {
      const discountLabel = c.type === 'percent'
        ? `Giảm ${c.value}%`
        : `Giảm ${formatVND(c.value)}`;

      return `
        <div class="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50">
          <div>
            <div class="font-mono font-bold text-emerald-700">${escapeHtml(c.code)}</div>
            <div class="text-xs font-semibold text-slate-800">${escapeHtml(discountLabel)}</div>
            <div class="text-[11px] text-slate-500">${escapeHtml(c.description || '')}</div>
          </div>
          <button
            type="button"
            class="btn-delete-coupon text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1 rounded bg-red-50 hover:bg-red-100 transition-colors"
            data-coupon-code="${escapeHtml(c.code)}"
          >
            Xóa
          </button>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.btn-delete-coupon').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = btn.getAttribute('data-coupon-code');
      if (!code) return;
      if (!confirm(`Bạn có chắc chắn muốn xóa mã giảm giá "${code}"?`)) return;
      try {
        const res = await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          allCoupons = data.coupons || allCoupons.filter((c) => c.code !== code);
          renderCouponList();
        } else {
          alert('Lỗi xóa coupon: ' + (data.error || 'Không thể xóa'));
        }
      } catch (err) {
        alert('Lỗi kết nối máy chủ: ' + err.message);
      }
    });
  });
}

// Panel 3: Cấu hình ngân hàng VietQR
function renderBankSettingsForm() {
  const bankIdInput = document.getElementById('setting-bank-id');
  const accNoInput = document.getElementById('setting-account-no');
  const accNameInput = document.getElementById('setting-account-name');

  const bId = bankSettings.bankId || 'MB';
  const aNo = bankSettings.accountNo || '0988123456';
  const aName = bankSettings.accountName || 'CONG TY TNHH HOSTING ADVISOR';

  if (bankIdInput) bankIdInput.value = bId;
  if (accNoInput) accNoInput.value = aNo;
  if (accNameInput) accNameInput.value = aName;

  updateLiveBankQrPreview();
}

function updateLiveBankQrPreview() {
  const bankIdInput = document.getElementById('setting-bank-id');
  const accNoInput = document.getElementById('setting-account-no');
  const accNameInput = document.getElementById('setting-account-name');
  const qrPreviewImg = document.getElementById('admin-bank-qr-preview');
  const qrCaption = document.getElementById('admin-bank-qr-caption');

  const bId = bankIdInput?.value || bankSettings.bankId || 'MB';
  const aNo = accNoInput?.value.trim() || bankSettings.accountNo || '0988123456';
  const aName = accNameInput?.value.trim().toUpperCase() || bankSettings.accountName || 'CONG TY TNHH HOSTING ADVISOR';

  if (qrPreviewImg) {
    qrPreviewImg.src = `https://img.vietqr.io/image/${encodeURIComponent(bId)}-${encodeURIComponent(aNo)}-compact2.png?amount=10000&addInfo=TEST&accountName=${encodeURIComponent(aName)}`;
  }
  if (qrCaption) {
    qrCaption.textContent = `${bId} • ${aNo} • ${aName}`;
  }
}

// Panel 4: Quản lý đánh giá khách hàng (Reviews)
function renderAdminReviewsList() {
  const container = document.getElementById('admin-reviews-list');
  if (!container) return;

  if (allReviews.length === 0) {
    container.innerHTML = '<div class="col-span-3 text-xs text-slate-400 italic">Chưa có đánh giá nào của khách hàng.</div>';
    return;
  }

  container.innerHTML = allReviews
    .map((r) => {
      const starsLabel = `${r.rating || 5}/5 sao`;
      const dateFormatted = r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '';
      return `
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-slate-900">${escapeHtml(r.customerName)}</span>
              <span class="text-amber-700 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded border border-amber-200">${starsLabel}</span>
            </div>
            ${r.businessName ? `<div class="text-[11px] text-slate-500">${escapeHtml(r.businessName)}</div>` : ''}
            <div class="text-xs text-brand-700 font-medium mt-1">Gói: ${escapeHtml(r.planName)}</div>
            <p class="text-xs text-slate-700 mt-1 italic">"${escapeHtml(r.comment)}"</p>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-slate-200 mt-2">
            <span class="text-[11px] text-slate-400">${escapeHtml(dateFormatted)}</span>
            <button
              type="button"
              class="btn-delete-review text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-0.5 rounded bg-red-50 hover:bg-red-100 transition-colors"
              data-review-id="${escapeHtml(r.id)}"
            >
              Xóa Đánh Giá
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.btn-delete-review').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const revId = btn.getAttribute('data-review-id');
      if (!revId) return;
      if (!confirm('Bạn có chắc chắn muốn xóa đánh giá này?')) return;
      try {
        const res = await fetch(`/api/admin/reviews/${encodeURIComponent(revId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          allReviews = data.reviews || allReviews.filter((x) => x.id !== revId);
          renderAdminReviewsList();
        } else {
          alert('Lỗi: ' + (data.error || 'Không thể xóa'));
        }
      } catch (err) {
        alert('Lỗi kết nối máy chủ: ' + err.message);
      }
    });
  });
}

// =========================================================
// 8. KHỞI TẠO VÀ GẮN SỰ KIỆN TOÀN TRANG
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('admin-login-form');
  const loginError = document.getElementById('admin-login-error');
  const logoutBtn = document.getElementById('btn-admin-logout');
  const refreshBtn = document.getElementById('btn-admin-refresh');
  const exportBtn = document.getElementById('btn-export-csv');

  // Kiểm tra phiên đăng nhập đã lưu
  verifyAdminSession();

  // Đăng nhập Admin / Staff
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError?.classList.add('hidden');
    const username = document.getElementById('admin-username')?.value.trim();
    const password = document.getElementById('admin-password')?.value;

    if (!username || !password) {
      if (loginError) {
        loginError.textContent = 'Vui lòng điền tên đăng nhập và mật khẩu.';
        loginError.classList.remove('hidden');
      }
      return;
    }

    try {
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

      // Chặn nếu là tài khoản customer
      if (data.user.role !== 'admin' && data.user.role !== 'staff') {
        if (loginError) {
          loginError.textContent = 'Tài khoản Khách hàng không được phép truy cập Cổng Quản Trị OMS.';
          loginError.classList.remove('hidden');
        }
        return;
      }

      adminToken = data.token;
      adminUser = data.user;
      localStorage.setItem('ha_admin_token', adminToken);
      syncAdminScreenUI();
      await loadStaffAndOrders();
    } catch (err) {
      if (loginError) {
        loginError.textContent = 'Lỗi kết nối máy chủ: ' + err.message;
        loginError.classList.remove('hidden');
      }
    }
  });

  // Đăng xuất
  logoutBtn?.addEventListener('click', () => {
    adminToken = '';
    adminUser = null;
    localStorage.removeItem('ha_admin_token');
    syncAdminScreenUI();
  });

  // Làm mới dữ liệu
  refreshBtn?.addEventListener('click', () => loadStaffAndOrders());

  // Xuất báo cáo Excel / CSV
  exportBtn?.addEventListener('click', exportOrdersToExcel);
  document.getElementById('btn-export-csv-raw')?.addEventListener('click', exportOrdersToCSV);

  // Bộ lọc tìm kiếm & trạng thái đơn hàng
  document.getElementById('filter-search')?.addEventListener('input', renderOrdersTable);
  document.getElementById('filter-status')?.addEventListener('change', renderOrdersTable);
  document.getElementById('filter-assignee')?.addEventListener('change', renderOrdersTable);

  // Đóng modal chi tiết
  document.getElementById('btn-close-detail-modal')?.addEventListener('click', () => {
    document.getElementById('order-detail-modal')?.classList.add('hidden');
    activeOrder = null;
  });

  // Bấm phím ESC để đóng modal chi tiết
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('order-detail-modal')?.classList.add('hidden');
      activeOrder = null;
    }
  });

  // Nút Xác Nhận Đã Nhận Tiền & Kích Hoạt Dịch Vụ
  document.getElementById('btn-approve-payment')?.addEventListener('click', async () => {
    if (!activeOrder) return;
    if (!confirm(`Xác nhận đã nhận đủ tiền cho đơn hàng ${activeOrder.id} và kích hoạt cấp phát IP Hosting ngay?`)) return;

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(activeOrder.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'completed' })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const idx = allOrders.findIndex((o) => o.id === activeOrder.id);
        if (idx !== -1) allOrders[idx] = data.order;
        activeOrder = data.order;
        updateKPIs();
        renderOrdersTable();
        openOrderDetailModal(activeOrder.id);
        alert(`Đã kích hoạt đơn hàng ${activeOrder.id} thành công! IP Hosting: ${data.order.serviceDetails?.hostingIp}`);
      } else {
        alert('Lỗi duyệt đơn: ' + (data.error || 'Không thể kích hoạt'));
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ: ' + err.message);
    }
  });

  // Nút Lưu Cập Nhật Đơn Hàng (Status, Assignee, Notes)
  document.getElementById('btn-save-order-update')?.addEventListener('click', async () => {
    if (!activeOrder) return;
    const statusSelect = document.getElementById('detail-status-select');
    const assigneeSelect = document.getElementById('detail-assignee-select');
    const notesInput = document.getElementById('detail-notes-input');
    const saveMsg = document.getElementById('detail-save-msg');

    const status = statusSelect?.value;
    const assignedTo = assigneeSelect?.value;
    const notes = notesInput?.value;

    const payload = { status, notes };
    if (adminUser?.role === 'admin') {
      payload.assignedTo = assignedTo;
    }

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(activeOrder.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const idx = allOrders.findIndex((o) => o.id === activeOrder.id);
        if (idx !== -1) allOrders[idx] = data.order;
        activeOrder = data.order;
        updateKPIs();
        renderOrdersTable();
        openOrderDetailModal(activeOrder.id);
        if (saveMsg) {
          saveMsg.textContent = 'Đã lưu cập nhật đơn hàng thành công!';
          saveMsg.classList.remove('hidden');
          setTimeout(() => saveMsg.classList.add('hidden'), 3000);
        }
      } else {
        alert('Lỗi cập nhật: ' + (data.error || 'Không thể lưu'));
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ: ' + err.message);
    }
  });

  // Nút AI Soạn Kịch Bản Gọi Điện Telesale
  document.getElementById('btn-generate-sales-script')?.addEventListener('click', generateSalesScript);

  // Form Panel 1: Tạo nhân sự Staff mới
  document.getElementById('form-create-staff')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('staff-manage-msg');
    const uInput = document.getElementById('staff-new-username');
    const pInput = document.getElementById('staff-new-password');
    const fInput = document.getElementById('staff-new-fullname');
    const phoneInput = document.getElementById('staff-new-phone');

    const username = uInput?.value.trim();
    const password = pInput?.value;
    const fullName = fInput?.value.trim();
    const phone = phoneInput?.value.trim();

    if (!username || !password || !fullName) {
      if (msgEl) {
        msgEl.textContent = 'Vui lòng điền Username, Mật khẩu và Họ tên.';
        msgEl.className = 'text-xs font-medium text-red-600';
        msgEl.classList.remove('hidden');
      }
      return;
    }

    if (password.length < 6) {
      if (msgEl) {
        msgEl.textContent = 'Mật khẩu nhân viên tối thiểu phải từ 6 ký tự.';
        msgEl.className = 'text-xs font-medium text-red-600';
        msgEl.classList.remove('hidden');
      }
      return;
    }

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
      if (res.ok && data.ok) {
        if (msgEl) {
          msgEl.textContent = `Tạo tài khoản ${data.user.username} thành công!`;
          msgEl.className = 'text-xs font-medium text-emerald-600';
          msgEl.classList.remove('hidden');
        }
        uInput.value = '';
        pInput.value = '';
        fInput.value = '';
        phoneInput.value = '';
        await loadStaffAndOrders();
      } else {
        if (msgEl) {
          msgEl.textContent = data.error || 'Không thể tạo nhân sự.';
          msgEl.className = 'text-xs font-medium text-red-600';
          msgEl.classList.remove('hidden');
        }
      }
    } catch (err) {
      if (msgEl) {
        msgEl.textContent = 'Lỗi kết nối máy chủ: ' + err.message;
        msgEl.className = 'text-xs font-medium text-red-600';
        msgEl.classList.remove('hidden');
      }
    }
  });

  // Form Panel 2: Tạo mã giảm giá (Coupon)
  document.getElementById('form-create-coupon')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('coupon-manage-msg');
    const cCodeInput = document.getElementById('coupon-new-code');
    const cTypeInput = document.getElementById('coupon-new-type');
    const cValInput = document.getElementById('coupon-new-value');
    const cDescInput = document.getElementById('coupon-new-desc');

    const code = cCodeInput?.value.trim().toUpperCase();
    const type = cTypeInput?.value || 'percent';
    const value = Number(cValInput?.value) || 0;
    const description = cDescInput?.value.trim();

    if (!code || value <= 0) {
      if (msgEl) {
        msgEl.textContent = 'Vui lòng nhập mã coupon và giá trị hợp lệ (> 0).';
        msgEl.className = 'text-xs font-medium text-red-600';
        msgEl.classList.remove('hidden');
      }
      return;
    }

    if (type === 'percent' && (value < 1 || value > 99)) {
      if (msgEl) {
        msgEl.textContent = 'Giá trị giảm theo % phải từ 1% đến 99%.';
        msgEl.className = 'text-xs font-medium text-red-600';
        msgEl.classList.remove('hidden');
      }
      return;
    }

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
      if (res.ok && data.ok) {
        if (msgEl) {
          msgEl.textContent = `Thêm mã coupon ${code} thành công!`;
          msgEl.className = 'text-xs font-medium text-emerald-600';
          msgEl.classList.remove('hidden');
        }
        cCodeInput.value = '';
        cValInput.value = '';
        cDescInput.value = '';
        allCoupons = data.coupons || [];
        renderCouponList();
      } else {
        if (msgEl) {
          msgEl.textContent = data.error || 'Không thể tạo mã giảm giá.';
          msgEl.className = 'text-xs font-medium text-red-600';
          msgEl.classList.remove('hidden');
        }
      }
    } catch (err) {
      if (msgEl) {
        msgEl.textContent = 'Lỗi kết nối máy chủ: ' + err.message;
        msgEl.className = 'text-xs font-medium text-red-600';
        msgEl.classList.remove('hidden');
      }
    }
  });

  // Form Panel 3: Cấu hình ngân hàng VietQR & Live preview
  const bIdInput = document.getElementById('setting-bank-id');
  const aNoInput = document.getElementById('setting-account-no');
  const aNameInput = document.getElementById('setting-account-name');

  bIdInput?.addEventListener('change', updateLiveBankQrPreview);
  aNoInput?.addEventListener('input', updateLiveBankQrPreview);
  aNameInput?.addEventListener('input', updateLiveBankQrPreview);

  document.getElementById('form-bank-settings')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('bank-settings-msg');
    const bankId = bIdInput?.value.trim().toUpperCase() || 'MB';
    const accountNo = aNoInput?.value.trim();
    const accountName = aNameInput?.value.trim().toUpperCase();

    if (!accountNo || !accountName) {
      if (msgEl) {
        msgEl.textContent = 'Vui lòng điền số tài khoản và tên chủ tài khoản.';
        msgEl.className = 'text-xs font-medium text-red-600';
        msgEl.classList.remove('hidden');
      }
      return;
    }

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
      if (res.ok && data.ok) {
        bankSettings = data.settings || { bankId, accountNo, accountName };
        if (msgEl) {
          msgEl.textContent = 'Đã lưu cấu hình tài khoản ngân hàng VietQR thành công!';
          msgEl.className = 'text-xs font-medium text-emerald-600';
          msgEl.classList.remove('hidden');
          setTimeout(() => msgEl.classList.add('hidden'), 4000);
        }
        updateLiveBankQrPreview();
      } else {
        if (msgEl) {
          msgEl.textContent = data.error || 'Không thể lưu cấu hình ngân hàng.';
          msgEl.className = 'text-xs font-medium text-red-600';
          msgEl.classList.remove('hidden');
        }
      }
    } catch (err) {
      if (msgEl) {
        msgEl.textContent = 'Lỗi kết nối máy chủ: ' + err.message;
        msgEl.className = 'text-xs font-medium text-red-600';
        msgEl.classList.remove('hidden');
      }
    }
  });
});
