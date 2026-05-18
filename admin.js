/* ======================================================
   admin.js — لوحة الإدارة (نسخة مصحّحة)
   ====================================================== */

var BLOG_DATA_URL  = '/data.json';
var BLOG_USERS_URL = '/users.json';
var ADMIN_SESS_KEY = 'admin_unlocked';

/* ═══════════════════════════════════════════════
   Gate — التحقق من رمز الإدارة
   ═══════════════════════════════════════════════ */
function checkToken() {
  var input = document.getElementById('token-input');
  var err   = document.getElementById('gate-error');
  if (!input) return;
  var val = input.value.trim();
  if (!val) {
    err.textContent = '⚠️ أدخل الرمز أولاً.';
    err.style.display = 'block';
    return;
  }
  err.style.display = 'none';

  fetch(BLOG_USERS_URL + '?t=' + Date.now())
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (val === data.admin_token) {
        sessionStorage.setItem(ADMIN_SESS_KEY, '1');
        showAdminPanel();
      } else {
        err.textContent = '❌ الرمز غير صحيح — احصل عليه من البوت عبر /admintoken';
        err.style.display = 'block';
      }
    })
    .catch(function() {
      err.textContent = '⚠️ تعذر الاتصال بالخادم.';
      err.style.display = 'block';
    });
}

function adminLogout() {
  sessionStorage.removeItem(ADMIN_SESS_KEY);
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('token-gate').style.display  = 'block';
  var inp = document.getElementById('token-input');
  if (inp) inp.value = '';
}

/* ═══════════════════════════════════════════════
   Dashboard
   ═══════════════════════════════════════════════ */
function showAdminPanel() {
  document.getElementById('token-gate').style.display  = 'none';
  document.getElementById('admin-panel').style.display = 'block';
  loadDashboard();
}

function loadDashboard() {
  Promise.all([
    fetch(BLOG_DATA_URL  + '?t=' + Date.now()).then(function(r){ return r.json(); }).catch(function(){ return { posts: [] }; }),
    fetch(BLOG_USERS_URL + '?t=' + Date.now()).then(function(r){ return r.json(); }).catch(function(){ return { users: [] }; }),
  ]).then(function(results) {
    var blogData  = results[0];
    var usersData = results[1];

    var posts   = blogData.posts  || [];
    var pending = [];
    try { pending = JSON.parse(localStorage.getItem('pending_users') || '[]'); } catch(e) {}
    var users   = (usersData.users || []).slice();
    for (var i = 0; i < pending.length; i++) {
      var pu = pending[i];
      if (!users.find(function(u){ return u.email === pu.email; })) users.push(pu);
    }

    var totalViews = posts.reduce(function(s, p){ return s + (p.views || 0); }, 0);
    var sorted     = posts.slice().sort(function(a, b){ return new Date(b.date||0) - new Date(a.date||0); });
    var latest     = sorted[0];

    document.getElementById('total-posts').textContent = posts.length;
    document.getElementById('total-views').textContent = totalViews.toLocaleString('ar-SA');
    document.getElementById('total-users').textContent = users.length;
    document.getElementById('latest-date').textContent = latest
      ? new Date(latest.date).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })
      : '—';

    renderPosts(sorted);
    renderUsers(users);
  }).catch(function(e) {
    console.error('loadDashboard error:', e);
  });
}

function renderPosts(posts) {
  var tbody = document.getElementById('posts-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!posts.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">لا توجد مقالات</td></tr>';
    return;
  }
  posts.slice(0, 15).forEach(function(p) {
    var media = '<span class="badge-none">—</span>';
    if (p.image_url) media = '<span class="badge badge-img">🖼 صورة</span>';
    else if (p.video_url) media = '<span class="badge badge-vid">🎬 فيديو</span>';
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + p.id + '</td>' +
      '<td><a class="post-link" href="/post.html?id=' + p.id + '" target="_blank">' + (p.title || '').slice(0, 45) + '</a></td>' +
      '<td>' + new Date(p.date || '').toLocaleDateString('ar-SA') + '</td>' +
      '<td>' + (p.views || 0).toLocaleString('ar-SA') + '</td>' +
      '<td>' + media + '</td>';
    tbody.appendChild(tr);
  });
}

function renderUsers(users) {
  var tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">لا يوجد مستخدمون بعد</td></tr>';
    return;
  }
  users.forEach(function(u, i) {
    var status = u.banned
      ? '<span class="badge" style="background:rgba(224,87,87,.15);color:#e05757">🚫 محظور</span>'
      : '<span class="badge badge-img">✅ نشط</span>';
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + (i + 1) + '</td>' +
      '<td>' + (u.username || '—') + '</td>' +
      '<td>' + (u.email || '—') + '</td>' +
      '<td>' + (u.joined ? new Date(u.joined).toLocaleDateString('ar-SA') : '—') + '</td>' +
      '<td>' + status + '</td>';
    tbody.appendChild(tr);
  });
}

/* ── تبويبات ── */
function switchTab(tabName, clickedBtn) {
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('active'); });
  document.querySelectorAll('.tab-panel').forEach(function(p){ p.style.display = 'none'; });
  if (clickedBtn) clickedBtn.classList.add('active');
  var panel = document.getElementById('tab-' + tabName);
  if (panel) panel.style.display = 'block';
}

/* ── إعداد أولي ── */
document.addEventListener('DOMContentLoaded', function() {
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var tokenInput = document.getElementById('token-input');
  if (tokenInput) {
    tokenInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') checkToken();
    });
  }

  if (sessionStorage.getItem(ADMIN_SESS_KEY)) {
    showAdminPanel();
  }
});
