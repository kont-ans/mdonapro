/* ======================================================
   auth.js — نظام المصادقة الكامل (نسخة مصحّحة)
   ====================================================== */

const USERS_URL   = '/users.json';
const SESSION_KEY = 'blog_session';

/* ── تشفير كلمة المرور SHA-256 ── */
async function hashPassword(password) {
  const enc = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/* ── قوة كلمة المرور (1-4) ── */
function passwordStrength(pw) {
  if (!pw || pw.length < 6) return 1;
  let s = 1;
  if (pw.length >= 8)              s++;
  if (/[0-9]/.test(pw))            s++;
  if (/[^a-zA-Z0-9]/.test(pw) && pw.length >= 10) s = 4;
  return Math.min(s, 4);
}

/* ── جلب المستخدمين من users.json (مع دمج pending في localStorage) ── */
async function getUsers() {
  var serverUsers = [];
  try {
    var r    = await fetch(USERS_URL + '?t=' + Date.now());
    var data = await r.json();
    serverUsers = data.users || [];
  } catch (e) {
    console.warn('Could not fetch users.json:', e);
  }
  var pending = [];
  try {
    pending = JSON.parse(localStorage.getItem('pending_users') || '[]');
  } catch(e) {}

  var merged = serverUsers.slice();
  for (var i = 0; i < pending.length; i++) {
    var pu = pending[i];
    if (!merged.find(function(u) { return u.email === pu.email; })) {
      merged.push(pu);
    }
  }
  return merged;
}

/* ── جلب ملف users.json كاملاً ── */
async function getUsersData() {
  try {
    var r = await fetch(USERS_URL + '?t=' + Date.now());
    return await r.json();
  } catch(e) {
    return { admin_token: 'admin1234', users: [] };
  }
}

/* ── تسجيل مستخدم جديد (يُخزن في localStorage حتى يزامنه البوت) ── */
async function registerUser(newUser) {
  try {
    var pending = [];
    try { pending = JSON.parse(localStorage.getItem('pending_users') || '[]'); } catch(e) {}
    pending.push(newUser);
    localStorage.setItem('pending_users', JSON.stringify(pending));
    return true;
  } catch(e) {
    console.error('registerUser error:', e);
    return false;
  }
}

/* ── جلسة المستخدم ── */
function saveSession(user) {
  var session = {};
  for (var k in user) session[k] = user[k];
  delete session.password_hash;
  session.loginAt = Date.now();
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch(e) { return null; }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function logout() {
  clearSession();
  window.location.href = '/index.html';
}

/* ── مساعدات UI ── */
function showError(el, msg) {
  el.textContent = '⚠️ ' + msg;
  el.style.display = 'block';
}

function togglePw(id) {
  var el  = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}

/* ── تحديث رأس الصفحة بحالة الدخول ── */
function updateHeaderAuth() {
  var navEl   = document.getElementById('header-nav');
  if (!navEl) return;
  var session = getSession();
  if (session) {
    navEl.innerHTML =
      '<div class="user-chip">' +
        '<span class="user-avatar">' + (session.username || '?').charAt(0).toUpperCase() + '</span>' +
        '<span>' + (session.username || '') + '</span>' +
        '<button onclick="logout()" class="btn-logout-sm">خروج</button>' +
      '</div>';
  } else {
    navEl.innerHTML =
      '<div class="auth-nav">' +
        '<a href="/login.html"    class="btn-nav-login">دخول</a>' +
        '<a href="/register.html" class="btn-nav-reg">حساب جديد</a>' +
      '</div>';
  }
}

document.addEventListener('DOMContentLoaded', updateHeaderAuth);
