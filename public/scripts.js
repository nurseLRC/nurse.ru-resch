let SESSION_TOKEN = '';
let CURRENT_REPORT_URL = '';
let ALL_MENUS = [];

const CONFIG = {
  API_BASE: 'https://script.google.com/macros/s/AKfycbw-g3WymkaJ7SXwhTqtZWF9gjM51-LcFHLTYwD0LYTn74UtlB5llbZwUblQjnglz0a4/exec'
};

document.addEventListener('DOMContentLoaded', function () {
  bootstrapDashboard();
});

function getTokenFromUrl() {
  const url = new URL(window.location.href);

  const tokenFromQuery = url.searchParams.get('token');
  if (tokenFromQuery) {
    try {
      localStorage.setItem('LRC_SESSION_TOKEN', tokenFromQuery);
    } catch (e) {}
    return tokenFromQuery;
  }

  try {
    const tokenFromLocal = localStorage.getItem('LRC_SESSION_TOKEN');
    if (tokenFromLocal) return tokenFromLocal;
  } catch (e) {}

  return '';
}

async function apiGet(action, params = {}) {
  const url = new URL(CONFIG.API_BASE);
  url.searchParams.set('action', action);

  Object.keys(params).forEach(function (key) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      url.searchParams.set(key, params[key]);
    }
  });

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ');
  }

  return await res.json();
}

async function bootstrapDashboard() {
  showLoading();

  SESSION_TOKEN = getTokenFromUrl();

  if (!SESSION_TOKEN) {
    showDeny('ไม่พบ session กรุณาเข้าสู่ระบบใหม่');
    return;
  }

  try {
    const res = await apiGet('dashboardBootstrap', {
      sessionToken: SESSION_TOKEN
    });

    handleBootstrapSuccess(res);
  } catch (err) {
    showDeny(err?.message || 'โหลด dashboard ไม่สำเร็จ');
  }

  setTimeout(function () {
    const loading = document.getElementById('loadingOverlay');
    const dashboard = document.getElementById('dashboardView');
    const deny = document.getElementById('denyView');

    const stillLoading = loading && !loading.classList.contains('hidden');
    const stillHiddenDashboard = dashboard && dashboard.classList.contains('hidden');
    const stillHiddenDeny = deny && deny.classList.contains('hidden');

    if (stillLoading && stillHiddenDashboard && stillHiddenDeny) {
      showDeny('ระบบใช้เวลานานผิดปกติ กรุณาลองเข้าสู่ระบบใหม่');
    }
  }, 8000);
}

function handleBootstrapSuccess(res) {
  hideLoading();

  if (!res || res.ok === false) {
    showDeny(res?.message || 'ไม่สามารถเข้าใช้งานได้');
    return;
  }

  renderDashboard(res);
}

function renderDashboard(res) {
  const dashboardView = document.getElementById('dashboardView');
  if (dashboardView) dashboardView.classList.remove('hidden');

  setText('userName', res.user?.fullName || '-');
  setText('userEmail', res.user?.email || '-');
  setText('userRole', 'สิทธิ์: ' + (res.user?.role || '-'));

  setText('summaryName', res.user?.fullName || '-');
  setText('summaryRole', res.user?.role || '-');
  setText('summaryTime', res.nowText || '-');

  ALL_MENUS = Array.isArray(res.menus) ? res.menus : [];
  buildDynamicMenu(ALL_MENUS);

  if (res.defaultReport) {
    openReport(res.defaultReport.key);
  } else {
    setText('reportTitle', 'ยังไม่มีรายงาน');
    setText('reportSubtitle', 'role นี้ยังไม่ถูกกำหนดรายงาน');
    setText('iframeNote', 'กรุณาเพิ่มข้อมูลในชีต ROLE_REPORTS');

    const emptyBox = document.getElementById('emptyBox');
    const reportFrameWrap = document.getElementById('reportFrameWrap');
    if (reportFrameWrap) reportFrameWrap.classList.add('hidden');
    if (emptyBox) emptyBox.classList.remove('hidden');
  }
}

function buildDynamicMenu(menus) {
  const container = document.getElementById('dynamicMenu');
  if (!container) return;

  container.innerHTML = '';

  menus.forEach(function (menu, index) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-btn' + (index === 0 ? ' active' : '');
    btn.textContent = menu.label || menu.key || 'รายงาน';
    btn.dataset.key = menu.key;

    btn.onclick = function () {
      btn.classList.add('clicked');

      setTimeout(function () {
        btn.classList.remove('clicked');
      }, 180);

      setActiveMenu(menu.key);
      openReport(menu.key);
    };

    container.appendChild(btn);
  });
}

function setActiveMenu(key) {
  document.querySelectorAll('#dynamicMenu .menu-btn').forEach(function (el) {
    el.classList.remove('active');
    if (el.dataset.key === key) el.classList.add('active');
  });
}

function openReport(key) {
  const report = ALL_MENUS.find(function (item) {
    return item.key === key;
  });

  const reportFrameWrap = document.getElementById('reportFrameWrap');
  const emptyBox = document.getElementById('emptyBox');
  const lookerFrame = document.getElementById('lookerFrame');

  if (!report) {
    setText('reportTitle', 'ไม่พบรายงาน');
    setText('reportSubtitle', '-');
    setText('iframeNote', 'ไม่พบเมนูที่เลือก');

    if (reportFrameWrap) reportFrameWrap.classList.add('hidden');
    if (emptyBox) emptyBox.classList.remove('hidden');
    if (lookerFrame) lookerFrame.src = '';
    return;
  }

  CURRENT_REPORT_URL = report.url || '';
  setText('reportTitle', report.label || 'รายงาน');
  setText('reportSubtitle', 'กำลังแสดงรายงานตามสิทธิ์ของผู้ใช้งาน');
  setText('iframeNote', 'รายงานนี้ถูกควบคุมจากชีต ROLE_REPORTS');

  if (emptyBox) emptyBox.classList.add('hidden');

  if (!CURRENT_REPORT_URL) {
    if (reportFrameWrap) reportFrameWrap.classList.add('hidden');
    setText('iframeNote', 'ยังไม่ได้ใส่ REPORT_URL ใน ROLE_REPORTS');
    if (emptyBox) emptyBox.classList.remove('hidden');
    if (lookerFrame) lookerFrame.src = '';
    return;
  }

  if (lookerFrame) {
    lookerFrame.src = CURRENT_REPORT_URL;
  }

  if (reportFrameWrap) {
    reportFrameWrap.classList.remove('hidden');
  }
}

function refreshCurrentReport() {
  if (!CURRENT_REPORT_URL) return;

  const iframe = document.getElementById('lookerFrame');
  if (!iframe) return;

  iframe.src =
    CURRENT_REPORT_URL +
    (CURRENT_REPORT_URL.includes('?') ? '&' : '?') +
    'refresh=' +
    Date.now();
}

async function logoutNow() {
  try {
    localStorage.removeItem('LRC_SESSION_TOKEN');
  } catch (e) {}

  try {
    if (SESSION_TOKEN) {
      await apiGet('logout', { sessionToken: SESSION_TOKEN });
    }
  } catch (e) {}

  goLogin();
}

function goLogin() {
  try {
    localStorage.removeItem('LRC_SESSION_TOKEN');
  } catch (e) {}

  window.location.href = 'login.html';
}

function showDeny(message) {
  hideLoading();

  const denyView = document.getElementById('denyView');
  if (denyView) denyView.classList.remove('hidden');

  setText('denyMessage', message || '-');
}

function showLoading() {
  const loading = document.getElementById('loadingOverlay');
  if (loading) loading.classList.remove('hidden');
}

function hideLoading() {
  const loading = document.getElementById('loadingOverlay');
  if (loading) loading.classList.add('hidden');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}