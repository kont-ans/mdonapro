/* ======================================================
   script.js — الصفحة الرئيسية
   ====================================================== */

var DATA_URL = '/data.json';

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch(e) { return dateStr || ''; }
}

function createCard(post) {
  var card = document.createElement('div');
  card.className = 'article-card';
  card.onclick = function() { window.location.href = '/post.html?id=' + post.id; };

  var mediaHtml = '';
  if (post.image_url) {
    mediaHtml = '<img class="card-thumb" src="' + post.image_url + '" alt="' + (post.title||'') + '" loading="lazy" onerror="this.style.display=\'none\'">';
  } else if (post.video_url) {
    mediaHtml = '<div class="card-thumb-placeholder">▶</div>';
  } else {
    mediaHtml = '<div class="card-thumb-placeholder">✦</div>';
  }

  var content = post.content || '';
  var excerpt = content.slice(0, 100) + (content.length > 100 ? '...' : '');

  var mediaBadge = '';
  if (post.image_url)      mediaBadge = '<span class="card-media-badge">📷 صورة</span>';
  else if (post.video_url) mediaBadge = '<span class="card-media-badge">🎬 فيديو</span>';

  card.innerHTML =
    mediaHtml +
    '<div class="card-body">' +
      '<h2 class="card-title">' + (post.title || 'بدون عنوان') + '</h2>' +
      '<p class="card-excerpt">' + (excerpt || 'لا يوجد نص') + '</p>' +
      '<div class="card-footer">' +
        '<span class="card-date">📅 ' + formatDate(post.date) + '</span>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          mediaBadge +
          '<span class="card-views">👁 ' + (post.views || 0).toLocaleString('ar-SA') + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';

  return card;
}

function loadPosts() {
  var grid        = document.getElementById('articles-grid');
  var loading     = document.getElementById('loading');
  var empty       = document.getElementById('empty-state');
  var maintenance = document.getElementById('maintenance-banner');

  fetch(DATA_URL + '?t=' + Date.now())
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.maintenance) {
        maintenance.style.display = 'block';
      }

      var posts = (data.posts || data || []).slice().sort(function(a, b) {
        return new Date(b.date || 0) - new Date(a.date || 0);
      });

      loading.style.display = 'none';

      if (!posts.length) {
        empty.style.display = 'block';
        return;
      }

      grid.style.display = 'grid';
      posts.forEach(function(p) { grid.appendChild(createCard(p)); });
    })
    .catch(function(e) {
      loading.style.display = 'none';
      empty.style.display   = 'block';
      console.error('Failed to load posts:', e);
    });
}

var yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

loadPosts();
