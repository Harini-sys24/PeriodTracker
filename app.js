/* ══════════════════════════════════════════
   History_Store — localStorage CRUD
══════════════════════════════════════════ */
const History_Store = {
  KEY: 'pt_history',
  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); }
    catch { console.warn('pt_history parse error'); return []; }
  },
  save(entries) {
    try { localStorage.setItem(this.KEY, JSON.stringify(entries)); }
    catch { App.showStorageError(); }
  },
  add(entry) { const e = this.load(); e.push(entry); this.save(e); },
  remove(index) { const e = this.load(); e.splice(index, 1); this.save(e); },
  clear() { localStorage.removeItem(this.KEY); }
};

/* ══════════════════════════════════════════
   Predictor — pure date math
══════════════════════════════════════════ */
const Predictor = {
  nextPeriod(lastDate, cycleLength) {
    const d = new Date(lastDate);
    d.setDate(d.getDate() + cycleLength);
    return d;
  },
  fertileWindow(lastDate, cycleLength) {
    const start = new Date(lastDate);
    start.setDate(start.getDate() + cycleLength - 18);
    const end = new Date(lastDate);
    end.setDate(end.getDate() + cycleLength - 11);
    return { start, end };
  },
  // Returns positive = days until, negative = days overdue
  daysUntil(targetDate) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const t = new Date(targetDate); t.setHours(0, 0, 0, 0);
    return Math.round((t - today) / 86400000);
  },
  isAbnormal(cycleLength) {
    // Cycle < 21 days or > 35 days is considered irregular
    return cycleLength < 21 || cycleLength > 35;
  },
  // Returns how many days the period is delayed (positive = delayed, 0 or negative = not delayed)
  delayDays(lastDate, cycleLength) {
    const days = this.daysUntil(this.nextPeriod(lastDate, cycleLength));
    return days < 0 ? Math.abs(days) : 0;
  }
};

/* ══════════════════════════════════════════
   Insight_Engine — smart messages
══════════════════════════════════════════ */
const Insight_Engine = {
  generate(lastDate, cycleLength) {
    const insights = [];
    const next = Predictor.nextPeriod(lastDate, cycleLength);
    const days = Predictor.daysUntil(next);
    const fw = Predictor.fertileWindow(lastDate, cycleLength);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const fwStart = new Date(fw.start); fwStart.setHours(0, 0, 0, 0);
    const fwEnd = new Date(fw.end); fwEnd.setHours(0, 0, 0, 0);
    const inFW = today >= fwStart && today <= fwEnd;
    const delay = Predictor.delayDays(lastDate, cycleLength);

    if (Predictor.isAbnormal(cycleLength))
      insights.push({ icon: '⚠️', text: 'Your cycle seems irregular. Consider consulting a doctor.' });

    if (delay > 7)
      insights.push({ icon: '🔴', text: `Your period is delayed by ${delay} day(s). Please consider consulting a doctor.` });
    else if (delay > 0)
      insights.push({ icon: '🟡', text: `Your period appears delayed by ${delay} day(s).` });
    else if (days <= 3 && days >= 0)
      insights.push({ icon: '🩸', text: 'Your period is expected soon.' });

    if (inFW)
      insights.push({ icon: '🌿', text: 'You are currently in your fertile window.' });

    if (!Predictor.isAbnormal(cycleLength) && delay === 0 && !inFW && days > 3)
      insights.push({ icon: '✅', text: 'Your cycle appears to be on track.' });

    return insights;
  }
};

/* ══════════════════════════════════════════
   Food_Advisor — phase-based suggestions
══════════════════════════════════════════ */
const Food_Advisor = {
  suggest(lastDate, cycleLength) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const next = Predictor.nextPeriod(lastDate, cycleLength);
    const daysToNext = Predictor.daysUntil(next);
    const fw = Predictor.fertileWindow(lastDate, cycleLength);
    const fwStart = new Date(fw.start); fwStart.setHours(0, 0, 0, 0);
    const fwEnd = new Date(fw.end); fwEnd.setHours(0, 0, 0, 0);
    const inFW = today >= fwStart && today <= fwEnd;

    if (Predictor.isAbnormal(cycleLength))
      return { phase: 'Irregular Cycle', foods: ['💧 Drink plenty of water', '🍎 Fresh fruits & vegetables', '🥗 Balanced diet with whole grains', '🥜 Nuts and seeds for nutrients'] };
    if (daysToNext <= 3 && daysToNext >= -7)
      return { phase: 'Pre-Period / Period Phase', foods: ['🥬 Spinach & leafy greens (iron-rich)', '🫘 Lentils & legumes', '🥩 Lean red meat', '🥣 Fortified cereals', '🍫 Dark chocolate (magnesium)'] };
    if (inFW)
      return { phase: 'Fertile Window', foods: ['🥦 Leafy greens & broccoli', '🥜 Nuts & seeds', '🌾 Whole grains', '🫐 Antioxidant-rich berries', '🐟 Omega-3 rich fish'] };
    return { phase: 'General Cycle Phase', foods: ['🥗 Balanced diet with all food groups', '💧 Stay well hydrated', '🍌 Potassium-rich foods', '🧘 Maintain healthy lifestyle'] };
  }
};

/* ══════════════════════════════════════════
   Chart_Renderer — canvas bar chart
══════════════════════════════════════════ */
const Chart_Renderer = {
  render(canvasEl, entries) {
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    const w = canvasEl.offsetWidth || 600;
    canvasEl.width = w;
    const h = 200;
    ctx.clearRect(0, 0, w, h);

    const isDark = document.body.classList.contains('dark');
    const textColor = isDark ? '#f0f0f0' : '#2d2d2d';
    const gridColor = isDark ? '#3a3a5c' : '#f0c0d8';

    const maxLen = Math.max(...entries.map(e => e.cycleLength), 40);
    const barW = Math.min(40, (w - 60) / entries.length - 8);
    const chartH = h - 40;

    // Grid lines
    [0.25, 0.5, 0.75, 1].forEach(r => {
      const y = h - 30 - chartH * r;
      ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 10, y); ctx.stroke();
      ctx.fillStyle = textColor; ctx.font = '10px sans-serif';
      ctx.fillText(Math.round(maxLen * r), 2, y + 4);
    });

    entries.forEach((entry, i) => {
      const barH = (entry.cycleLength / maxLen) * chartH;
      const x = 50 + i * ((w - 60) / entries.length);
      const y = h - 30 - barH;
      ctx.fillStyle = Predictor.isAbnormal(entry.cycleLength) ? '#f44336' : '#e91e8c';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, barW, barH, 4);
      else ctx.rect(x, y, barW, barH);
      ctx.fill();
      ctx.fillStyle = textColor; ctx.font = '9px sans-serif';
      ctx.fillText(entry.date.slice(5), x, h - 10); // MM-DD label
    });
  }
};

/* ══════════════════════════════════════════
   Notification_Manager
══════════════════════════════════════════ */
const Notification_Manager = {
  isSupported() { return typeof Notification !== 'undefined'; },
  async requestPermission() {
    if (!this.isSupported()) return 'unsupported';
    return Notification.requestPermission();
  },
  schedule(lastDate, cycleLength) {
    if (!this.isSupported() || Notification.permission !== 'granted') return;
    const days = Predictor.daysUntil(Predictor.nextPeriod(lastDate, cycleLength));
    const fw = Predictor.fertileWindow(lastDate, cycleLength);
    const fwDays = Predictor.daysUntil(fw.start);
    if (days === 3) new Notification('🩸 Period Tracker', { body: 'Your period is expected in 3 days.' });
    if (days === 1) new Notification('🩸 Period Tracker', { body: 'Your period is expected tomorrow.' });
    if (fwDays === 1) new Notification('🌿 Period Tracker', { body: 'Your fertile window starts tomorrow.' });
    if (fwDays === 0) new Notification('🌿 Period Tracker', { body: 'Your fertile window starts today.' });
  }
};

/* ══════════════════════════════════════════
   PIN_Lock
══════════════════════════════════════════ */
const PIN_Lock = {
  KEY: 'pt_pin',
  isSet() { return !!localStorage.getItem(this.KEY); },
  set(pin) { localStorage.setItem(this.KEY, btoa(pin)); },
  verify(pin) {
    try { return atob(localStorage.getItem(this.KEY) || '') === pin; }
    catch { return false; }
  },
  reset() { ['pt_pin', 'pt_history', 'pt_theme'].forEach(k => localStorage.removeItem(k)); }
};

/* ══════════════════════════════════════════
   App — main controller
══════════════════════════════════════════ */
const App = {
  init() {
    this.applyTheme();
    if (PIN_Lock.isSet()) this.showPinEntry();
    else this.showPinSetup();
    this.bindPinEvents();
  },

  /* ── Theme ── */
  applyTheme() {
    const t = localStorage.getItem('pt_theme') || 'light';
    document.body.className = t;
    document.getElementById('dark-toggle').textContent = t === 'dark' ? '☀️' : '🌙';
  },
  toggleTheme() {
    const next = document.body.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem('pt_theme', next);
    this.applyTheme();
    // Re-render chart with new theme colors if visible
    const canvas = document.getElementById('cycle-chart');
    if (!canvas.classList.contains('hidden')) {
      const entries = History_Store.load();
      if (entries.length >= 2) setTimeout(() => Chart_Renderer.render(canvas, entries), 50);
    }
  },

  /* ── PIN screens ── */
  showPinSetup() {
    document.getElementById('pin-label').textContent = 'Set a 4-digit PIN to protect your data';
    document.getElementById('pin-submit-btn').textContent = 'Set PIN';
    document.getElementById('pin-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
    this._pinMode = 'setup';
  },
  showPinEntry() {
    document.getElementById('pin-label').textContent = 'Enter your 4-digit PIN';
    document.getElementById('pin-submit-btn').textContent = 'Unlock';
    document.getElementById('pin-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
    this._pinMode = 'verify';
  },
  showApp() {
    document.getElementById('pin-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    this.bindAppEvents();
    this.renderHistory();
  },

  bindPinEvents() {
    document.getElementById('pin-submit-btn').addEventListener('click', () => {
      const pin = document.getElementById('pin-input').value.trim();
      const err = document.getElementById('pin-error');
      if (!/^\d{4}$/.test(pin)) {
        err.textContent = 'PIN must be exactly 4 digits.';
        err.classList.remove('hidden'); return;
      }
      err.classList.add('hidden');
      if (this._pinMode === 'setup') {
        PIN_Lock.set(pin); this.showApp();
      } else {
        if (PIN_Lock.verify(pin)) {
          this.showApp();
        } else {
          err.textContent = 'Incorrect PIN. Try again.';
          err.classList.remove('hidden');
          document.getElementById('pin-input').value = '';
        }
      }
    });
    document.getElementById('pin-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('pin-submit-btn').click();
    });
    document.getElementById('pin-reset-btn').addEventListener('click', () => {
      if (confirm('This will delete ALL your data and reset the PIN. Continue?')) {
        PIN_Lock.reset();
        document.getElementById('pin-input').value = '';
        this.showPinSetup();
      }
    });
  },

  bindAppEvents() {
    if (this._appBound) return;
    this._appBound = true;
    document.getElementById('dark-toggle').addEventListener('click', () => this.toggleTheme());
    document.getElementById('lock-btn').addEventListener('click', () => {
      document.getElementById('pin-input').value = '';
      this.showPinEntry();
    });
    document.getElementById('predict-btn').addEventListener('click', () => this.handlePredict());
    document.getElementById('doctor-btn').addEventListener('click', () => {
      window.open('https://www.google.com/maps/search/gynecologist+near+me', '_blank');
    });
    document.getElementById('notif-btn').addEventListener('click', async () => {
      if (!Notification_Manager.isSupported()) {
        alert('Notifications are not supported in your browser.'); return;
      }
      const perm = await Notification_Manager.requestPermission();
      if (perm === 'granted') alert('Notifications enabled!');
      else if (perm === 'denied') alert('Notifications blocked. Enable them in browser settings.');
    });
  },

  handlePredict() {
    const dateVal = document.getElementById('last-date').value;
    const cycleVal = parseInt(document.getElementById('cycle-len').value, 10);
    const dateErr = document.getElementById('date-error');
    const cycleErr = document.getElementById('cycle-error');
    let valid = true;

    dateErr.classList.add('hidden');
    cycleErr.classList.add('hidden');

    if (!dateVal) {
      dateErr.textContent = 'Please enter your last period date.';
      dateErr.classList.remove('hidden'); valid = false;
    }
    if (!cycleVal || cycleVal < 1 || cycleVal > 90) {
      cycleErr.textContent = 'Please enter a cycle length between 1 and 90 days.';
      cycleErr.classList.remove('hidden'); valid = false;
    }
    if (!valid) return;

    History_Store.add({ date: dateVal, cycleLength: cycleVal });
    this.renderResults(dateVal, cycleVal);
    this.renderHistory();
    Notification_Manager.schedule(new Date(dateVal), cycleVal);
  },

  renderResults(dateVal, cycleLen) {
    const lastDate = new Date(dateVal);
    const next = Predictor.nextPeriod(lastDate, cycleLen);
    const fw = Predictor.fertileWindow(lastDate, cycleLen);
    const days = Predictor.daysUntil(next);
    const delay = Predictor.delayDays(lastDate, cycleLen);
    const fmt = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    document.getElementById('next-period').textContent = fmt(next);
    document.getElementById('days-away').textContent = days >= 0 ? `${days} days` : `${Math.abs(days)} days ago`;
    document.getElementById('fertile-window').textContent = `${fmt(fw.start)} – ${fmt(fw.end)}`;

    // General alert (abnormal cycle only — delay is handled by doctor section)
    const alertBox = document.getElementById('alert-box');
    if (Predictor.isAbnormal(cycleLen)) {
      alertBox.textContent = '⚠️ Your cycle seems irregular. Consider consulting a doctor.';
      alertBox.className = 'alert danger';
      alertBox.classList.remove('hidden');
    } else {
      alertBox.classList.add('hidden');
    }

    // ── Conditional Doctor Button ──
    // Show ONLY when period is delayed by MORE than 7 days
    const doctorSection = document.getElementById('doctor-section');
    if (delay > 7) {
      document.getElementById('delay-message').textContent =
        `🔴 Your period seems delayed by ${delay} day(s). Consider consulting a doctor.`;
      doctorSection.classList.remove('hidden');
    } else {
      // Hide completely when not delayed enough
      doctorSection.classList.add('hidden');
    }

    // Smart Insights
    const insights = Insight_Engine.generate(lastDate, cycleLen);
    document.getElementById('insights-box').innerHTML = insights
      .map(i => `<div class="insight-item">${i.icon} ${i.text}</div>`)
      .join('');

    // Food suggestions
    const food = Food_Advisor.suggest(lastDate, cycleLen);
    document.getElementById('food-box').innerHTML =
      `<strong>🍽️ ${food.phase} — Recommended Foods:</strong><ul>${food.foods.map(f => `<li>${f}</li>`).join('')}</ul>`;

    document.getElementById('results').classList.remove('hidden');
  },

  renderHistory() {
    const entries = History_Store.load().slice().reverse();
    const list = document.getElementById('history-list');

    if (!entries.length) {
      list.innerHTML = '<li class="muted">No cycle history yet.</li>';
      document.getElementById('chart-section').classList.add('hidden');
      return;
    }

    list.innerHTML = entries.map((e, i) => {
      const abnormal = Predictor.isAbnormal(e.cycleLength);
      const realIdx = History_Store.load().length - 1 - i;
      return `<li class="history-item">
        <span class="hi-date">${e.date}</span>
        <span class="hi-cycle">${e.cycleLength} days</span>
        <span class="hi-badge ${abnormal ? 'abnormal' : ''}">${abnormal ? 'Irregular' : 'Normal'}</span>
        <button class="del-btn" data-idx="${realIdx}" title="Delete entry" aria-label="Delete entry">🗑️</button>
      </li>`;
    }).join('');

    list.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        History_Store.remove(parseInt(btn.dataset.idx, 10));
        this.renderHistory();
      });
    });

    // Chart — needs at least 2 entries
    const allEntries = History_Store.load();
    const chartSection = document.getElementById('chart-section');
    const canvas = document.getElementById('cycle-chart');
    const placeholder = document.getElementById('chart-placeholder');
    if (allEntries.length >= 2) {
      chartSection.classList.remove('hidden');
      placeholder.classList.add('hidden');
      canvas.classList.remove('hidden');
      setTimeout(() => Chart_Renderer.render(canvas, allEntries), 50);
    } else {
      chartSection.classList.remove('hidden');
      placeholder.classList.remove('hidden');
      canvas.classList.add('hidden');
    }
  },

  showStorageError() {
    alert('Could not save data. Storage may be full.');
  }
};

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        // Notify SW to skip waiting when a new version is available
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage('SKIP_WAITING');
            }
          });
        });
      })
      .catch(err => console.warn('SW registration failed:', err));
  });
}

// ── PWA Install Prompt ──
let _deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredInstallPrompt = e;
  // Show banner after a short delay so it doesn't feel intrusive
  setTimeout(() => {
    document.getElementById('install-banner').classList.remove('hidden');
  }, 2000);
});

window.addEventListener('appinstalled', () => {
  document.getElementById('install-banner').classList.add('hidden');
  _deferredInstallPrompt = null;
});

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('install-btn').addEventListener('click', async () => {
    if (!_deferredInstallPrompt) return;
    _deferredInstallPrompt.prompt();
    const { outcome } = await _deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      document.getElementById('install-banner').classList.add('hidden');
    }
    _deferredInstallPrompt = null;
  });

  document.getElementById('install-dismiss').addEventListener('click', () => {
    document.getElementById('install-banner').classList.add('hidden');
  });

  App.init();
});
