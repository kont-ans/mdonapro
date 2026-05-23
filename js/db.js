// ============================================================
// InstaMina - IndexedDB Core Engine
// ============================================================
const DB_NAME = 'InstaMina';
const DB_VERSION = 1;
let db;

const InstaMina = {
  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('users')) {
          const us = d.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
          us.createIndex('username', 'username', { unique: true });
          us.createIndex('email', 'email', { unique: true });
        }
        if (!d.objectStoreNames.contains('posts')) {
          const ps = d.createObjectStore('posts', { keyPath: 'id', autoIncrement: true });
          ps.createIndex('userId', 'userId', { unique: false });
          ps.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!d.objectStoreNames.contains('stories')) {
          const ss = d.createObjectStore('stories', { keyPath: 'id', autoIncrement: true });
          ss.createIndex('userId', 'userId', { unique: false });
        }
        if (!d.objectStoreNames.contains('comments')) {
          const cs = d.createObjectStore('comments', { keyPath: 'id', autoIncrement: true });
          cs.createIndex('postId', 'postId', { unique: false });
        }
        if (!d.objectStoreNames.contains('likes')) {
          const ls = d.createObjectStore('likes', { keyPath: 'id', autoIncrement: true });
          ls.createIndex('postId', 'postId', { unique: false });
          ls.createIndex('userId', 'userId', { unique: false });
        }
        if (!d.objectStoreNames.contains('follows')) {
          const fs = d.createObjectStore('follows', { keyPath: 'id', autoIncrement: true });
          fs.createIndex('followerId', 'followerId', { unique: false });
          fs.createIndex('followingId', 'followingId', { unique: false });
        }
        if (!d.objectStoreNames.contains('messages')) {
          const ms = d.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
          ms.createIndex('fromId', 'fromId', { unique: false });
          ms.createIndex('toId', 'toId', { unique: false });
        }
        if (!d.objectStoreNames.contains('notifications')) {
          const ns = d.createObjectStore('notifications', { keyPath: 'id', autoIncrement: true });
          ns.createIndex('userId', 'userId', { unique: false });
        }
        if (!d.objectStoreNames.contains('saved')) {
          const sv = d.createObjectStore('saved', { keyPath: 'id', autoIncrement: true });
          sv.createIndex('userId', 'userId', { unique: false });
        }
        if (!d.objectStoreNames.contains('reports')) {
          const rp = d.createObjectStore('reports', { keyPath: 'id', autoIncrement: true });
          rp.createIndex('targetId', 'targetId', { unique: false });
        }
        if (!d.objectStoreNames.contains('settings')) {
          d.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = () => reject(req.error);
    });
  },

  // ---- AUTH ----
  getCurrentUser() {
    const u = localStorage.getItem('instamina_user');
    return u ? JSON.parse(u) : null;
  },
  setCurrentUser(user) {
    localStorage.setItem('instamina_user', JSON.stringify(user));
  },
  logout() {
    localStorage.removeItem('instamina_user');
    window.location.href = 'index.html';
  },
  requireAuth() {
    const u = this.getCurrentUser();
    if (!u) { window.location.href = 'index.html'; return null; }
    return u;
  },

  // ---- USERS ----
  async createUser(data) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const user = {
        username: data.username,
        email: data.email,
        password: data.password,
        fullName: data.fullName || data.username,
        bio: '',
        avatar: data.avatar || null,
        website: '',
        isVerified: false,
        isBanned: false,
        isAdmin: false,
        postsCount: 0,
        followersCount: 0,
        followingCount: 0,
        createdAt: Date.now()
      };
      const req = store.add(user);
      req.onsuccess = () => { user.id = req.result; resolve(user); };
      req.onerror = () => reject(req.error);
    });
  },
  async getUserById(id) {
    return new Promise((resolve) => {
      const tx = db.transaction('users', 'readonly');
      const req = tx.objectStore('users').get(Number(id));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  },
  async getUserByUsername(username) {
    return new Promise((resolve) => {
      const tx = db.transaction('users', 'readonly');
      const idx = tx.objectStore('users').index('username');
      const req = idx.get(username);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  },
  async getUserByEmail(email) {
    return new Promise((resolve) => {
      const tx = db.transaction('users', 'readonly');
      const idx = tx.objectStore('users').index('email');
      const req = idx.get(email);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  },
  async getAllUsers() {
    return new Promise((resolve) => {
      const tx = db.transaction('users', 'readonly');
      const req = tx.objectStore('users').getAll();
      req.onsuccess = () => resolve(req.result || []);
    });
  },
  async updateUser(id, updates) {
    return new Promise(async (resolve) => {
      const user = await this.getUserById(id);
      if (!user) return resolve(null);
      const updated = { ...user, ...updates };
      const tx = db.transaction('users', 'readwrite');
      tx.objectStore('users').put(updated);
      tx.oncomplete = () => resolve(updated);
    });
  },
  async deleteUser(id) {
    return new Promise((resolve) => {
      const tx = db.transaction('users', 'readwrite');
      tx.objectStore('users').delete(Number(id));
      tx.oncomplete = () => resolve(true);
    });
  },
  async searchUsers(query) {
    const all = await this.getAllUsers();
    const q = query.toLowerCase();
    return all.filter(u => u.username.toLowerCase().includes(q) || (u.fullName && u.fullName.toLowerCase().includes(q)));
  },

  // ---- POSTS ----
  async createPost(data) {
    return new Promise((resolve) => {
      const tx = db.transaction('posts', 'readwrite');
      const post = {
        userId: data.userId,
        caption: data.caption || '',
        image: data.image || null,
        video: data.video || null,
        type: data.type || 'post',
        location: data.location || '',
        tags: data.tags || [],
        likesCount: 0,
        commentsCount: 0,
        isDeleted: false,
        createdAt: Date.now()
      };
      const req = tx.objectStore('posts').add(post);
      req.onsuccess = () => { post.id = req.result; resolve(post); };
    });
  },
  async getPostById(id) {
    return new Promise((resolve) => {
      const tx = db.transaction('posts', 'readonly');
      const req = tx.objectStore('posts').get(Number(id));
      req.onsuccess = () => resolve(req.result || null);
    });
  },
  async getAllPosts() {
    return new Promise((resolve) => {
      const tx = db.transaction('posts', 'readonly');
      const req = tx.objectStore('posts').getAll();
      req.onsuccess = () => resolve((req.result || []).filter(p => !p.isDeleted).sort((a, b) => b.createdAt - a.createdAt));
    });
  },
  async getPostsByUser(userId) {
    const all = await this.getAllPosts();
    return all.filter(p => p.userId === Number(userId));
  },
  async updatePost(id, updates) {
    return new Promise(async (resolve) => {
      const post = await this.getPostById(id);
      if (!post) return resolve(null);
      const updated = { ...post, ...updates };
      const tx = db.transaction('posts', 'readwrite');
      tx.objectStore('posts').put(updated);
      tx.oncomplete = () => resolve(updated);
    });
  },
  async deletePost(id) {
    return this.updatePost(id, { isDeleted: true });
  },

  // ---- STORIES ----
  async createStory(data) {
    return new Promise((resolve) => {
      const tx = db.transaction('stories', 'readwrite');
      const story = {
        userId: data.userId,
        image: data.image,
        text: data.text || '',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        createdAt: Date.now(),
        views: []
      };
      const req = tx.objectStore('stories').add(story);
      req.onsuccess = () => { story.id = req.result; resolve(story); };
    });
  },
  async getActiveStories() {
    return new Promise((resolve) => {
      const tx = db.transaction('stories', 'readonly');
      const req = tx.objectStore('stories').getAll();
      req.onsuccess = () => {
        const now = Date.now();
        resolve((req.result || []).filter(s => s.expiresAt > now));
      };
    });
  },
  async getStoriesByUser(userId) {
    const all = await this.getActiveStories();
    return all.filter(s => s.userId === Number(userId));
  },

  // ---- LIKES ----
  async toggleLike(postId, userId) {
    const existing = await this.getLike(postId, userId);
    if (existing) {
      await new Promise((resolve) => {
        const tx = db.transaction('likes', 'readwrite');
        tx.objectStore('likes').delete(existing.id);
        tx.oncomplete = () => resolve();
      });
      const post = await this.getPostById(postId);
      if (post) await this.updatePost(postId, { likesCount: Math.max(0, post.likesCount - 1) });
      return false;
    } else {
      await new Promise((resolve) => {
        const tx = db.transaction('likes', 'readwrite');
        tx.objectStore('likes').add({ postId: Number(postId), userId: Number(userId), createdAt: Date.now() });
        tx.oncomplete = () => resolve();
      });
      const post = await this.getPostById(postId);
      if (post) await this.updatePost(postId, { likesCount: (post.likesCount || 0) + 1 });
      return true;
    }
  },
  async getLike(postId, userId) {
    return new Promise((resolve) => {
      const tx = db.transaction('likes', 'readonly');
      const req = tx.objectStore('likes').getAll();
      req.onsuccess = () => {
        const found = (req.result || []).find(l => l.postId === Number(postId) && l.userId === Number(userId));
        resolve(found || null);
      };
    });
  },
  async getLikesByPost(postId) {
    return new Promise((resolve) => {
      const tx = db.transaction('likes', 'readonly');
      const idx = tx.objectStore('likes').index('postId');
      const req = idx.getAll(Number(postId));
      req.onsuccess = () => resolve(req.result || []);
    });
  },

  // ---- COMMENTS ----
  async addComment(data) {
    return new Promise((resolve) => {
      const tx = db.transaction('comments', 'readwrite');
      const comment = {
        postId: Number(data.postId),
        userId: Number(data.userId),
        text: data.text,
        createdAt: Date.now()
      };
      const req = tx.objectStore('comments').add(comment);
      req.onsuccess = async () => {
        comment.id = req.result;
        const post = await this.getPostById(data.postId);
        if (post) await this.updatePost(data.postId, { commentsCount: (post.commentsCount || 0) + 1 });
        resolve(comment);
      };
    });
  },
  async getCommentsByPost(postId) {
    return new Promise((resolve) => {
      const tx = db.transaction('comments', 'readonly');
      const idx = tx.objectStore('comments').index('postId');
      const req = idx.getAll(Number(postId));
      req.onsuccess = () => resolve((req.result || []).sort((a, b) => a.createdAt - b.createdAt));
    });
  },
  async deleteComment(id) {
    return new Promise((resolve) => {
      const tx = db.transaction('comments', 'readwrite');
      tx.objectStore('comments').delete(Number(id));
      tx.oncomplete = () => resolve(true);
    });
  },

  // ---- FOLLOWS ----
  async toggleFollow(followerId, followingId) {
    const existing = await this.getFollow(followerId, followingId);
    if (existing) {
      await new Promise((resolve) => {
        const tx = db.transaction('follows', 'readwrite');
        tx.objectStore('follows').delete(existing.id);
        tx.oncomplete = () => resolve();
      });
      await this.updateUser(followerId, { followingCount: Math.max(0, (await this.getUserById(followerId)).followingCount - 1) });
      await this.updateUser(followingId, { followersCount: Math.max(0, (await this.getUserById(followingId)).followersCount - 1) });
      return false;
    } else {
      await new Promise((resolve) => {
        const tx = db.transaction('follows', 'readwrite');
        tx.objectStore('follows').add({ followerId: Number(followerId), followingId: Number(followingId), createdAt: Date.now() });
        tx.oncomplete = () => resolve();
      });
      await this.updateUser(followerId, { followingCount: ((await this.getUserById(followerId)).followingCount || 0) + 1 });
      await this.updateUser(followingId, { followersCount: ((await this.getUserById(followingId)).followersCount || 0) + 1 });
      return true;
    }
  },
  async getFollow(followerId, followingId) {
    return new Promise((resolve) => {
      const tx = db.transaction('follows', 'readonly');
      const req = tx.objectStore('follows').getAll();
      req.onsuccess = () => {
        const found = (req.result || []).find(f => f.followerId === Number(followerId) && f.followingId === Number(followingId));
        resolve(found || null);
      };
    });
  },
  async getFollowers(userId) {
    return new Promise((resolve) => {
      const tx = db.transaction('follows', 'readonly');
      const idx = tx.objectStore('follows').index('followingId');
      const req = idx.getAll(Number(userId));
      req.onsuccess = () => resolve(req.result || []);
    });
  },
  async getFollowing(userId) {
    return new Promise((resolve) => {
      const tx = db.transaction('follows', 'readonly');
      const idx = tx.objectStore('follows').index('followerId');
      const req = idx.getAll(Number(userId));
      req.onsuccess = () => resolve(req.result || []);
    });
  },

  // ---- MESSAGES ----
  async sendMessage(fromId, toId, text) {
    return new Promise((resolve) => {
      const tx = db.transaction('messages', 'readwrite');
      const msg = { fromId: Number(fromId), toId: Number(toId), text, read: false, createdAt: Date.now() };
      const req = tx.objectStore('messages').add(msg);
      req.onsuccess = () => { msg.id = req.result; resolve(msg); };
    });
  },
  async getConversation(userId1, userId2) {
    return new Promise((resolve) => {
      const tx = db.transaction('messages', 'readonly');
      const req = tx.objectStore('messages').getAll();
      req.onsuccess = () => {
        const msgs = (req.result || []).filter(m =>
          (m.fromId === Number(userId1) && m.toId === Number(userId2)) ||
          (m.fromId === Number(userId2) && m.toId === Number(userId1))
        ).sort((a, b) => a.createdAt - b.createdAt);
        resolve(msgs);
      };
    });
  },
  async getConversationList(userId) {
    return new Promise((resolve) => {
      const tx = db.transaction('messages', 'readonly');
      const req = tx.objectStore('messages').getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        const convMap = {};
        all.forEach(m => {
          const otherId = m.fromId === Number(userId) ? m.toId : m.toId === Number(userId) ? m.fromId : null;
          if (!otherId) return;
          if (!convMap[otherId] || m.createdAt > convMap[otherId].createdAt) convMap[otherId] = m;
        });
        resolve(Object.entries(convMap).map(([id, msg]) => ({ userId: Number(id), lastMessage: msg })));
      };
    });
  },

  // ---- NOTIFICATIONS ----
  async addNotification(data) {
    return new Promise((resolve) => {
      const tx = db.transaction('notifications', 'readwrite');
      const notif = {
        userId: Number(data.userId),
        type: data.type,
        fromId: Number(data.fromId),
        postId: data.postId ? Number(data.postId) : null,
        text: data.text,
        read: false,
        createdAt: Date.now()
      };
      const req = tx.objectStore('notifications').add(notif);
      req.onsuccess = () => { notif.id = req.result; resolve(notif); };
    });
  },
  async getNotifications(userId) {
    return new Promise((resolve) => {
      const tx = db.transaction('notifications', 'readonly');
      const idx = tx.objectStore('notifications').index('userId');
      const req = idx.getAll(Number(userId));
      req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.createdAt - a.createdAt));
    });
  },
  async markNotificationsRead(userId) {
    const notifs = await this.getNotifications(userId);
    const tx = db.transaction('notifications', 'readwrite');
    notifs.filter(n => !n.read).forEach(n => tx.objectStore('notifications').put({ ...n, read: true }));
  },

  // ---- SAVED ----
  async toggleSaved(userId, postId) {
    return new Promise(async (resolve) => {
      const tx = db.transaction('saved', 'readonly');
      const req = tx.objectStore('saved').getAll();
      req.onsuccess = () => {
        const existing = (req.result || []).find(s => s.userId === Number(userId) && s.postId === Number(postId));
        if (existing) {
          const tx2 = db.transaction('saved', 'readwrite');
          tx2.objectStore('saved').delete(existing.id);
          tx2.oncomplete = () => resolve(false);
        } else {
          const tx2 = db.transaction('saved', 'readwrite');
          tx2.objectStore('saved').add({ userId: Number(userId), postId: Number(postId), createdAt: Date.now() });
          tx2.oncomplete = () => resolve(true);
        }
      };
    });
  },
  async getSavedPosts(userId) {
    return new Promise((resolve) => {
      const tx = db.transaction('saved', 'readonly');
      const idx = tx.objectStore('saved').index('userId');
      const req = idx.getAll(Number(userId));
      req.onsuccess = () => resolve(req.result || []);
    });
  },
  async isSaved(userId, postId) {
    return new Promise((resolve) => {
      const tx = db.transaction('saved', 'readonly');
      const req = tx.objectStore('saved').getAll();
      req.onsuccess = () => resolve(!!(req.result || []).find(s => s.userId === Number(userId) && s.postId === Number(postId)));
    });
  },

  // ---- REPORTS ----
  async addReport(data) {
    return new Promise((resolve) => {
      const tx = db.transaction('reports', 'readwrite');
      const report = { ...data, createdAt: Date.now(), resolved: false };
      const req = tx.objectStore('reports').add(report);
      req.onsuccess = () => { report.id = req.result; resolve(report); };
    });
  },
  async getAllReports() {
    return new Promise((resolve) => {
      const tx = db.transaction('reports', 'readonly');
      const req = tx.objectStore('reports').getAll();
      req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.createdAt - a.createdAt));
    });
  },

  // ---- SETTINGS ----
  async getSetting(key) {
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
    });
  },
  async setSetting(key, value) {
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({ key, value });
      tx.oncomplete = () => resolve();
    });
  },

  // ---- HELPERS ----
  timeAgo(ts) {
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'الآن';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}د`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}س`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}ي`;
    const w = Math.floor(d / 7);
    if (w < 4) return `${w}أ`;
    return new Date(ts).toLocaleDateString('ar');
  },
  formatCount(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'م';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'ك';
    return n;
  },
  async exportAll() {
    const [users, posts, comments, likes, follows, messages, notifications, saved, reports] = await Promise.all([
      this.getAllUsers(), this.getAllPosts(),
      new Promise(r => { const tx = db.transaction('comments', 'readonly'); const req = tx.objectStore('comments').getAll(); req.onsuccess = () => r(req.result || []); }),
      new Promise(r => { const tx = db.transaction('likes', 'readonly'); const req = tx.objectStore('likes').getAll(); req.onsuccess = () => r(req.result || []); }),
      new Promise(r => { const tx = db.transaction('follows', 'readonly'); const req = tx.objectStore('follows').getAll(); req.onsuccess = () => r(req.result || []); }),
      new Promise(r => { const tx = db.transaction('messages', 'readonly'); const req = tx.objectStore('messages').getAll(); req.onsuccess = () => r(req.result || []); }),
      new Promise(r => { const tx = db.transaction('notifications', 'readonly'); const req = tx.objectStore('notifications').getAll(); req.onsuccess = () => r(req.result || []); }),
      new Promise(r => { const tx = db.transaction('saved', 'readonly'); const req = tx.objectStore('saved').getAll(); req.onsuccess = () => r(req.result || []); }),
      this.getAllReports()
    ]);
    return { users, posts, comments, likes, follows, messages, notifications, saved, reports, exportedAt: new Date().toISOString() };
  },

  // Seed demo data
  async seedDemo() {
    const existing = await this.getAllUsers();
    if (existing.length > 0) return;
    const users = [
      { username: 'ahmed_mina', email: 'ahmed@mina.com', password: '123456', fullName: 'أحمد مينا', isVerified: true, avatar: null },
      { username: 'sara_art', email: 'sara@mina.com', password: '123456', fullName: 'سارة الفنية', avatar: null },
      { username: 'travel_mo', email: 'mo@mina.com', password: '123456', fullName: 'محمد المسافر', avatar: null },
      { username: 'chef_nour', email: 'nour@mina.com', password: '123456', fullName: 'نور الطباخة', isVerified: true, avatar: null },
    ];
    for (const u of users) await this.createUser(u);
  }
};

// Dark mode support
(function() {
  const dm = localStorage.getItem('instamina_darkmode');
  if (dm === 'true') document.documentElement.classList.add('dark');
})();
