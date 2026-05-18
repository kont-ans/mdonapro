/* ======================================================
   post.js — صفحة المقالة الكاملة
   ====================================================== */

var DATA_URL = '/data.json';

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch(e) { return dateStr || ''; }
}

function loadPost() {
  var params   = new URLSearchParams(window.location.search);
  var id       = params.get('id');
  var loading  = document.getElementById('loading');
  var content  = document.getElementById('post-content');
  var notFound = document.getElementById('not-found');

  if (!id) {
    loading.style.display  = 'none';
    notFound.style.display = 'block';
    return;
  }

  fetch(DATA_URL + '?t=' + Date.now())
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var posts = data.posts || data || [];
      var post  = null;
      for (var i = 0; i < posts.length; i++) {
        if (String(posts[i].id) === String(id)) { post = posts[i]; break; }
      }

      if (!post) {
        loading.style.display  = 'none';
        notFound.style.display = 'block';
        return;
      }

      document.title = (post.title || 'مقالة') + ' — مدونتي';
      document.getElementById('post-title').textContent = post.title || 'بدون عنوان';
      document.getElementById('post-date').textContent  = '📅 ' + formatDate(post.date);
      document.getElementById('post-views').textContent = '👁 ' + ((post.views || 0) + 1).toLocaleString('ar-SA') + ' مشاهدة';
      document.getElementById('post-body').textContent  = post.content || '';

      var mediaEl = document.getElementById('post-media');
      if (post.image_url) {
        mediaEl.innerHTML = '<img src="' + post.image_url + '" alt="' + (post.title||'') + '" onerror="this.parentElement.style.display=\'none\'">';
      } else if (post.video_url) {
        mediaEl.innerHTML =
          '<video controls preload="metadata">' +
            '<source src="' + post.video_url + '">' +
            'متصفحك لا يدعم تشغيل الفيديو.' +
          '</video>';
      } else {
        mediaEl.style.display = 'none';
      }

      loading.style.display  = 'none';
      content.style.display  = 'block';
    })
    .catch(function(e) {
      loading.style.display  = 'none';
      notFound.style.display = 'block';
      console.error('Error loading post:', e);
    });
}

function sharePost() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: window.location.href });
  } else {
    navigator.clipboard.writeText(window.location.href)
      .then(function() { alert('تم نسخ رابط المقالة!'); })
      .catch(function() { alert(window.location.href); });
  }
}

var yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

loadPost();
