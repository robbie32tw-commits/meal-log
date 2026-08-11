/* 三餐日記 — screens, state and behaviour.
   One render function per screen; every screen reads from the record store,
   so nothing on screen is mock data. */

import { DB } from './db.js';
import { S, saveSettings, PHOTO_PRESET, APP_VERSION } from './settings.js';
import * as U from './util.js';

const C = '<i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>';

const phone = document.getElementById('phone');
const root = document.getElementById('screen');
const tabsEl = document.getElementById('tabs');
const fabEl = document.getElementById('fab');
const toastRoot = document.getElementById('toast-root');
const dialogRoot = document.getElementById('dialog-root');

const TABS = [
  ['today', '今日', '0'],
  ['month', '月曆', '0'],
  ['stats', '統計', '50%'],
  ['search', '搜尋', '50%'],
  ['settings', '設定', '0'],
];

const now = new Date();

const state = {
  screen: 'today',
  prev: 'today',
  meals: [],
  day: U.todayYmd(),
  dayFrom: 'today',
  month: { y: now.getFullYear(), m: now.getMonth() },
  range: 'week',
  form: null,
  query: '',
  filterTags: [],
  dialog: null,
  toast: null,
  storageText: '',
  focusSearch: false,
};

/* ── derived data ────────────────────────────────────────────────────── */

const mealsOn = date => state.meals.filter(m => m.date === date);
const mealPrice = m => Number(m.price) || 0;
const sum = list => list.reduce((t, m) => t + mealPrice(m), 0);
const cash = n => U.money(n, S.currency);

function tagPool() {
  const used = new Set(state.meals.flatMap(m => m.tags || []));
  return [...U.BASE_TAGS, ...[...used].filter(t => !U.BASE_TAGS.includes(t))];
}

function recentPlaces(limit = 3) {
  const seen = [];
  for (let i = state.meals.length - 1; i >= 0 && seen.length < limit; i--) {
    const p = (state.meals[i].place || '').trim();
    if (p && !seen.includes(p)) seen.push(p);
  }
  return seen;
}

/* ── object URLs: minted per render, released on the next one ────────── */

let urls = [];
const objUrl = blob => { const u = URL.createObjectURL(blob); urls.push(u); return u; };
const releaseUrls = () => { urls.forEach(URL.revokeObjectURL); urls = []; };
const photoOf = (m, fallback = 'PHOTO') =>
  m.photo ? `<img alt="" src="${objUrl(m.photo)}">` : fallback;

/* ── today ───────────────────────────────────────────────────────────── */

function todayView() {
  const date = U.todayYmd();
  const day = mealsOn(date);
  const snacks = day.filter(m => m.slot === U.SNACK);

  return `<div class="pad">
    <div class="today-head">
      <div>
        <h6 class="kicker">${U.fmtDayFull(date)}</h6>
        <h2 class="screen-title">今日三餐</h2>
      </div>
      <div class="today-total">
        <div class="num">${cash(sum(day))}</div>
        <div class="note">今日餐費</div>
      </div>
    </div>

    <div class="slot-list">
      ${U.SLOTS.map(slot => {
        // Two lunches in one day is a real thing — show every record for the
        // slot rather than silently keeping only the first.
        const ms = day.filter(x => x.slot === slot);
        return ms.length ? ms.map(mealCard).join('')
          : `<button class="slot-empty" data-act="add" data-arg="${slot}">
              <span class="plus">＋</span><span>記錄${slot}</span></button>`;
      }).join('')}
      ${snacks.map(mealCard).join('')}
    </div>

    <button class="line-btn" data-act="snack">＋ 點心／宵夜</button>
    <div class="note note-gap">點心不列入三餐完整度，只記在當日總計。</div>
  </div>`;
}

function mealCard(m) {
  return `<button class="meal-card blueprint" data-act="open-day" data-arg="${m.date}">${C}
    <div class="thumb duotone">${photoOf(m)}</div>
    <div class="meal-body">
      <div class="meal-top">
        <h6>${U.esc(m.slot)}</h6>
        <span class="meal-time">${U.esc(m.time)}</span>
      </div>
      <div class="meal-name">${U.esc(m.title)}</div>
      <div class="meal-foot">
        <div class="tags">${(m.tags || []).map(t => `<span class="tag tag-outline">${U.esc(t)}</span>`).join('')}</div>
        <span class="meal-price">${cash(mealPrice(m))}</span>
      </div>
    </div>
  </button>`;
}

/* ── add / edit ──────────────────────────────────────────────────────── */

function formView() {
  const f = state.form;
  const heading = { add: `新增${f.slot}`, snack: '新增點心', edit: '編輯記錄', backfill: `補記${f.slot}` }[f.mode];
  const when = f.date === U.todayYmd() ? '今天' : U.fmtDay(f.date);
  const places = recentPlaces();

  return `<div>
    <div class="form-head">
      <button class="text-btn" data-act="cancel-form">取消</button>
      <h6 class="form-title">${U.esc(heading)}</h6>
      <span class="form-date">${when}　${U.esc(f.time)}</span>
    </div>

    <button class="photo-drop blueprint duotone" data-act="photo-album" aria-label="選擇照片">${C}
      ${f.photo ? `<img alt="" src="${objUrl(f.photo)}">`
                : `<div class="cam-icon"><span></span></div>
                   <div class="photo-hint">拍照或從相簿選取</div>`}
    </button>
    <div class="photo-actions">
      <button class="btn btn-primary" data-act="photo-camera">拍照</button>
      <button class="btn btn-secondary" data-act="photo-album">相簿</button>
    </div>

    <div class="form-body">
      <div class="field">
        <label for="f-title">餐點名稱</label>
        <input class="input" id="f-title" data-field="title" value="${U.esc(f.title)}" placeholder="例如：鮭魚定食">
      </div>

      <div class="grid-2">
        <div class="field">
          <label for="f-price">價格</label>
          <input class="input" id="f-price" data-field="price" inputmode="numeric" value="${U.esc(f.price)}" placeholder="0">
        </div>
        <div class="field">
          <label>餐別</label>
          <div class="seg seg-full">
            ${U.SEG_LABELS.map(([short, slot]) => `<button class="seg-opt${f.slot === slot ? ' on' : ''}"
              data-act="pick-slot" data-arg="${slot}" aria-pressed="${f.slot === slot}">${short}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="field">
        <label for="f-place">店名／地點（選填）</label>
        <input class="input" id="f-place" data-field="place" value="${U.esc(f.place)}" placeholder="例如：和食 いち・信義店">
        ${places.length ? `<div class="note note-gap">最近的店：${places
          .map(p => `<button class="link-btn" data-act="pick-place" data-arg="${U.esc(p)}">${U.esc(p)}</button>`)
          .join('・')}</div>` : ''}
      </div>

      <div>
        <label class="field-label">標籤（選填）</label>
        <div class="tags">
          ${tagPool().map(t => `<button class="tag tag-outline tag-pick${f.tags.includes(t) ? ' on' : ''}"
            data-act="toggle-tag" data-arg="${U.esc(t)}" aria-pressed="${f.tags.includes(t)}">${U.esc(t)}</button>`).join('')}
        </div>
      </div>

      <div class="form-actions">
        <button class="btn btn-primary btn-block btn-save" data-act="save-form">${f.mode === 'edit' ? '儲存變更' : '儲存記錄'}</button>
        ${f.mode === 'edit' ? '<button class="btn btn-ghost btn-block btn-del" data-act="ask-delete">刪除這筆記錄</button>' : ''}
      </div>
    </div>
  </div>`;
}

/* ── month ───────────────────────────────────────────────────────────── */

function monthView() {
  const { y, m } = state.month;
  const dim = U.daysInMonth(y, m);
  const lead = (new Date(y, m, 1).getDay() - S.weekStart + 7) % 7;
  const today = U.todayYmd();

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="cal-pad"></span>');
  for (let d = 1; d <= dim; d++) {
    const date = `${y}-${U.pad2(m + 1)}-${U.pad2(d)}`;
    const n = Math.min(mealsOn(date).length, 3);
    cells.push(`<button class="cal-day${date === today ? ' today' : ''}" data-act="open-day" data-arg="${date}">
      ${d}
      <span class="cal-dots">${'<i></i>'.repeat(n)}</span>
    </button>`);
  }

  const inMonth = state.meals.filter(x => x.date.startsWith(`${y}-${U.pad2(m + 1)}`));
  const dayCount = new Set(inMonth.map(x => x.date)).size;

  return `<div class="pad">
    <div class="month-head">
      <div>
        <h6 class="kicker">${y}</h6>
        <h2 class="screen-title">${U.monthCh(m)}</h2>
      </div>
      <div class="month-arrows">
        <button class="icon-btn" data-act="month-step" data-arg="-1" aria-label="上個月">‹</button>
        <button class="icon-btn" data-act="month-step" data-arg="1" aria-label="下個月">›</button>
      </div>
    </div>

    <div class="cal-dow">${U.dowLabels(S.weekStart).map(d => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid">${cells.join('')}</div>
    <div class="note note-gap">點任一天可檢視當日記錄，或補記漏掉的餐次。</div>

    <div class="blueprint panel" style="margin-top:22px">${C}
      <h6>本月概況</h6>
      <div class="kpi">
        <div><div class="num">${dayCount}</div><div class="note">有記錄天數</div></div>
        <div><div class="num">${inMonth.length}</div><div class="note">餐次</div></div>
        <div><div class="num">${cash(sum(inMonth))}</div><div class="note">餐費合計</div></div>
      </div>
    </div>
  </div>`;
}

/* ── single day ──────────────────────────────────────────────────────── */

function dayView() {
  const date = state.day;
  const list = mealsOn(date);
  const missing = U.SLOTS.filter(s => !list.some(m => m.slot === s));

  return `<div class="pad">
    <button class="text-btn back-btn" data-act="back">← 返回</button>
    <h6 class="kicker">${U.fmtDayFull(date)}</h6>
    <h2 class="screen-title">單日詳情</h2>

    <div class="day-list" style="margin-top:16px">
      ${list.map(m => `<div>
        <div class="blueprint duotone day-photo">${C}${photoOf(m)}</div>
        <div class="day-meta">
          <div>
            <h6>${U.esc(m.slot)}　${U.esc(m.time)}</h6>
            <div class="day-name">${U.esc(m.title)}</div>
            ${m.place ? `<div class="day-place">${U.esc(m.place)}</div>` : ''}
          </div>
          <div class="day-price">${cash(mealPrice(m))}</div>
        </div>
        <div class="day-foot">
          <div class="tags">${(m.tags || []).map(t => `<span class="tag tag-outline">${U.esc(t)}</span>`).join('')}</div>
          <div class="day-actions">
            <button class="btn-line" data-act="edit" data-arg="${m.id}">編輯</button>
            <button class="btn-line subtle" data-act="ask-delete-id" data-arg="${m.id}">刪除</button>
          </div>
        </div>
      </div>`).join('')}

      ${missing.map(slot => `<button class="backfill" data-act="backfill" data-arg="${slot}" data-date="${date}">
        <span>＋ 補記${slot}</span>
        <span class="sub">這天沒有記錄</span>
      </button>`).join('')}
    </div>
  </div>`;
}

/* ── stats ───────────────────────────────────────────────────────────── */

function rangeDays() {
  const today = new Date();
  if (state.range === 'week') {
    const start = U.weekStartOf(today, S.weekStart);
    return Array.from({ length: 7 }, (_, i) => U.ymd(U.addDays(start, i)));
  }
  const y = today.getFullYear(), m = today.getMonth();
  return Array.from({ length: U.daysInMonth(y, m) }, (_, i) => `${y}-${U.pad2(m + 1)}-${U.pad2(i + 1)}`);
}

function weekBuckets(days) {
  const out = [];
  days.forEach(ds => {
    if (!out.length || U.parseYmd(ds).getDay() === S.weekStart) out.push([]);
    out[out.length - 1].push(ds);
  });
  return out.map((b, i) => ({ label: `W${i + 1}`, days: b }));
}

function statsView() {
  const isWeek = state.range === 'week';
  const days = rangeDays();
  const today = U.todayYmd();
  const elapsed = days.filter(d => d <= today);
  const set = new Set(days);
  const meals = state.meals.filter(m => set.has(m.date));
  const total = sum(meals);

  const buckets = isWeek
    ? days.map((d, i) => ({ label: U.dowLabels(S.weekStart)[i], days: [d] }))
    : weekBuckets(days);
  const values = buckets.map(b => sum(meals.filter(m => b.days.includes(m.date))));
  const max = Math.max(1, ...values);

  const rates = U.SLOTS.map(slot => {
    const hit = elapsed.filter(d => state.meals.some(m => m.date === d && m.slot === slot)).length;
    return { slot, pct: Math.round((hit / Math.max(1, elapsed.length)) * 100) };
  });

  const counts = new Map();
  meals.forEach(m => (m.tags || []).forEach(t => {
    const c = counts.get(t) || { n: 0, total: 0 };
    c.n++; c.total += mealPrice(m);
    counts.set(t, c);
  }));
  const topTags = [...counts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 4);

  const label = isWeek
    ? `${U.fmtDay(days[0])} – ${U.fmtDay(days[days.length - 1])}`
    : `${state.month.y} 年 ${new Date().getMonth() + 1} 月`;

  return `<div class="pad">
    <h6 class="kicker">${label}</h6>
    <h2 class="screen-title">統計趨勢</h2>

    <div class="seg seg-full range-seg" style="margin-top:12px">
      <button class="seg-opt${isWeek ? ' on' : ''}" data-act="set-range" data-arg="week" aria-pressed="${isWeek}">本週</button>
      <button class="seg-opt${isWeek ? '' : ' on'}" data-act="set-range" data-arg="month" aria-pressed="${!isWeek}">本月</button>
    </div>

    <div class="blueprint panel">${C}
      <div class="kpi">
        <div><div class="num">${meals.length}</div><div class="note">餐次</div></div>
        <div><div class="num">${cash(total)}</div><div class="note">餐費</div></div>
        <div><div class="num">${cash(total / Math.max(1, elapsed.length))}</div><div class="note">日均</div></div>
      </div>
    </div>

    <div class="blueprint panel panel-gap">${C}
      <h6>${isWeek ? '每日餐費' : '每週餐費'}</h6>
      <div class="bars">${values.map(v => `<i style="height:${Math.round((v / max) * 118)}px"></i>`).join('')}</div>
      <div class="bar-labels">${buckets.map(b => `<span>${b.label}</span>`).join('')}</div>
    </div>

    <div class="blueprint panel panel-gap">${C}
      <h6>記錄完整度</h6>
      <div class="rate-list">
        ${rates.map(r => `<div class="rate-row">
          <span class="rate-slot">${r.slot}</span>
          <span class="rate-track"><i style="width:${r.pct}%"></i></span>
          <span class="rate-pct">${r.pct}%</span>
        </div>`).join('')}
      </div>
    </div>

    <div class="blueprint panel panel-gap">${C}
      <h6>最常出現的標籤</h6>
      ${topTags.length ? `<table class="table"><tbody>
        ${topTags.map(([name, c]) => `<tr>
          <td>${U.esc(name)}</td>
          <td>${c.n} 次</td>
          <td>均 ${cash(c.total / c.n)}</td>
        </tr>`).join('')}
      </tbody></table>` : '<div class="empty">這段期間還沒有標籤。</div>'}
    </div>
  </div>`;
}

/* ── search ──────────────────────────────────────────────────────────── */

function matches() {
  const q = state.query.trim().toLowerCase();
  return state.meals
    .filter(m => state.filterTags.every(t => (m.tags || []).includes(t)))
    .filter(m => !q || [m.title, m.place, ...(m.tags || [])]
      .some(v => String(v || '').toLowerCase().includes(q)))
    .slice()
    .reverse();
}

function resultsHtml(list) {
  if (!list.length) return '<div class="empty">沒有符合的記錄。</div>';
  return list.map(m => `<button class="result blueprint" data-act="open-day" data-arg="${m.date}">${C}
    <div class="result-thumb duotone">${photoOf(m, '')}</div>
    <div class="result-body">
      <div class="result-title">${U.esc(m.title)}</div>
      <div class="result-meta">${U.fmtDay(m.date)}　${U.esc(m.slot)}</div>
    </div>
    <span class="result-price">${cash(mealPrice(m))}</span>
  </button>`).join('');
}

function searchView() {
  const list = matches();
  return `<div class="pad">
    <h2 class="screen-title">搜尋</h2>
    <input class="input" id="q" placeholder="餐點、店名、標籤" value="${U.esc(state.query)}" style="margin-top:12px">
    <div class="tags tags-gap">
      ${tagPool().map(t => `<button class="tag tag-outline tag-pick${state.filterTags.includes(t) ? ' on' : ''}"
        data-act="filter-tag" data-arg="${U.esc(t)}" aria-pressed="${state.filterTags.includes(t)}">${U.esc(t)}</button>`).join('')}
    </div>
    <h6 class="kicker results-head" id="result-count">${list.length} 筆結果</h6>
    <div class="result-list" id="result-list">${resultsHtml(list)}</div>
  </div>`;
}

function paintResults() {
  releaseUrls();
  const list = matches();
  root.querySelector('#result-count').textContent = `${list.length} 筆結果`;
  root.querySelector('#result-list').innerHTML = resultsHtml(list);
}

/* ── settings ────────────────────────────────────────────────────────── */

const PREFS = {
  autoSlot:     { label: '預設餐別依時間判斷', values: [true, false], text: v => (v ? '開啟' : '關閉') },
  photoQuality: { label: '照片畫質', values: ['標準', '高'], text: v => v },
  currency:     { label: '貨幣', values: ['TWD', 'JPY', 'USD'], text: v => v },
  weekStart:    { label: '週起始日', values: [1, 0], text: v => (v === 1 ? '星期一' : '星期日') },
};

const EXPORT_HINT = {
  CSV: '日期、餐別、餐點、店名、價格、標籤，可在 Excel 開啟',
  JSON: '含照片檔名的完整結構，適合轉移到其他 App',
  PDF: '含照片的月份相簿，可列印或分享',
};

function settingsView() {
  const lastBackup = S.lastBackup
    ? `${U.fmtDay(S.lastBackup.slice(0, 10))} ${S.lastBackup.slice(11, 16)}`
    : '尚未備份';

  return `<div class="pad">
    <h2 class="screen-title" style="margin-bottom:18px">設定與提醒</h2>

    <div class="blueprint rows">${C}
      <div class="row">版本<span class="row-value">${APP_VERSION}</span></div>
    </div>

    <h6 class="section-head">睡前提醒</h6>
    <div class="blueprint rows">${C}
      <div class="reminder-row">
        <div>
          <div class="reminder-slot">每天提醒</div>
          <input class="time-input" type="time" value="${S.reminder.time}" data-reminder-time>
        </div>
        <button class="switch${S.reminder.on ? ' on' : ''}" data-act="toggle-reminder"
          role="switch" aria-checked="${S.reminder.on}" aria-label="睡前提醒">
          <span class="switch-track"><i></i></span>
        </button>
      </div>
    </div>
    <div class="note note-gap">到時間若還有沒記錄的餐才會通知。只有 App 開著時才跳得出來——背景排程要原生 App 或推播服務。</div>

    <h6 class="section-head">推播樣式</h6>
    <div class="blueprint push">${C}
      <div class="push-row">
        <div class="push-icon">日記</div>
        <div class="push-body">
          <div class="push-meta"><span class="app">三餐日記</span><span>${U.esc(S.reminder.time)}</span></div>
          <div class="push-title">睡前記一下</div>
          <div class="push-text">今天還沒記錄午餐、晚餐。長按可直接拍照。</div>
        </div>
      </div>
      <div class="push-actions">
        <span class="lead">拍照記錄</span><span class="div"></span>
        <span>稍後提醒</span><span class="div"></span>
        <span>今天跳過</span>
      </div>
    </div>

    <h6 class="section-head">偏好</h6>
    <div class="blueprint rows">${C}
      ${Object.entries(PREFS).map(([key, p]) => `<button class="row row-btn" data-act="cycle-pref" data-arg="${key}">
        ${p.label}<span class="row-value">${p.text(S[key])}</span>
      </button>`).join('')}
    </div>

    <h6 class="section-head">匯出</h6>
    <div class="blueprint panel">${C}
      <div class="seg seg-full">
        ${['CSV', 'JSON', 'PDF'].map(f => `<button class="seg-opt${S.exportFmt === f ? ' on' : ''}"
          data-act="set-export" data-arg="${f}" aria-pressed="${S.exportFmt === f}">${f}</button>`).join('')}
      </div>
      <div class="export-hint">${EXPORT_HINT[S.exportFmt]}</div>
      <button class="btn btn-primary btn-block export-btn" data-act="do-export">匯出為 ${S.exportFmt}</button>
    </div>

    <h6 class="section-head">備份</h6>
    <div class="blueprint rows">${C}
      <div class="row">上次備份<span class="row-value">${lastBackup}</span></div>
      <div class="row">本機資料<span class="row-value">${state.meals.length} 筆${state.storageText ? '・' + state.storageText : ''}</span></div>
      <button class="row row-btn" data-act="backup">匯出備份檔（含照片）<span class="row-value">.json</span></button>
      <button class="row row-btn" data-act="restore">從備份檔還原<span class="row-value">選擇檔案</span></button>
    </div>

    <h6 class="section-head">同步裝置</h6>
    <div class="blueprint rows">${C}
      <div class="row">這台裝置<span class="row-value">本機儲存</span></div>
    </div>
    <button class="btn btn-secondary btn-block sync-btn" data-act="sync">立即同步</button>

    <h6 class="section-head">資料</h6>
    <div class="blueprint rows">${C}
      <button class="row row-btn" data-act="seed">載入範例資料<span class="row-value">最近三週</span></button>
      <button class="row row-btn" data-act="wipe">清除所有資料<span class="row-value danger">刪除</span></button>
    </div>
  </div>`;
}

/* ── render ──────────────────────────────────────────────────────────── */

const VIEWS = {
  today: todayView, add: formView, month: monthView, day: dayView,
  stats: statsView, search: searchView, settings: settingsView,
};

let lastScreen = null;
let lastScroll = 0;

function render() {
  if (state.screen === lastScreen) lastScroll = root.scrollTop;
  else lastScroll = 0;

  releaseUrls();
  root.innerHTML = VIEWS[state.screen]();
  root.scrollTop = lastScroll;
  lastScreen = state.screen;

  tabsEl.innerHTML = TABS.map(([key, label, shape]) =>
    `<button class="tab${state.screen === key ? ' on' : ''}" data-act="go" data-arg="${key}" aria-label="${label}">
      <i style="border-radius:${shape}"></i><span>${label}</span>
    </button>`).join('');
  fabEl.hidden = state.screen === 'add';

  toastRoot.innerHTML = state.toast
    ? `<div class="toast blueprint">${C}${U.esc(state.toast)}</div>` : '';

  dialogRoot.innerHTML = state.dialog ? `<div class="overlay">
    <div class="modal blueprint">${C}
      <h4>${U.esc(state.dialog.title)}</h4>
      <p>${U.esc(state.dialog.body)}</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-act="dialog-close">取消</button>
        <button class="btn btn-primary" data-act="dialog-confirm">${U.esc(state.dialog.confirm)}</button>
      </div>
    </div>
  </div>` : '';

  bindScreen();
}

function bindScreen() {
  if (state.screen === 'add') {
    root.querySelectorAll('[data-field]').forEach(el =>
      el.addEventListener('input', () => { state.form[el.dataset.field] = el.value; }));
  }
  if (state.screen === 'search') {
    const q = root.querySelector('#q');
    q.addEventListener('input', () => { state.query = q.value; paintResults(); });
    if (state.focusSearch) { q.focus(); state.focusSearch = false; }
  }
  if (state.screen === 'settings') {
    root.querySelectorAll('[data-reminder-time]').forEach(el => {
      el.addEventListener('click', () => el.showPicker?.());
      el.addEventListener('change', () => {
        S.reminder.time = el.value;
        saveSettings();
        scheduleReminders();
        render();
      });
    });
  }
}

let toastTimer;
function flash(msg) {
  state.toast = msg;
  render();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { state.toast = null; render(); }, 2600);
}

function go(screen) {
  state.prev = state.screen;
  state.screen = screen;
  if (screen === 'search') state.focusSearch = true;
  render();
}

async function reload() {
  state.meals = await DB.all();
}

/* ── form flow ───────────────────────────────────────────────────────── */

function openForm(mode, { slot, date, time, rec } = {}) {
  state.form = rec
    ? { mode, id: rec.id, date: rec.date, slot: rec.slot, time: rec.time,
        title: rec.title, price: String(rec.price ?? ''), place: rec.place || '',
        tags: [...(rec.tags || [])], photo: rec.photo || null }
    : { mode, id: null, date, slot, time,
        title: '', price: '', place: '', tags: [], photo: null };
  go('add');
}

function openAdd(slot) {
  const d = new Date();
  openForm(slot === U.SNACK ? 'snack' : 'add', { slot, date: U.todayYmd(), time: U.hm(d) });
}

async function saveForm() {
  const f = state.form;
  if (!f.title.trim()) return flash('請輸入餐點名稱');

  await DB.put({
    id: f.id || U.uid(),
    date: f.date,
    slot: f.slot,
    time: f.time,
    title: f.title.trim(),
    place: f.place.trim(),
    price: Number(String(f.price).replace(/[^\d.-]/g, '')) || 0,
    tags: f.tags,
    photo: f.photo || null,
    updatedAt: new Date().toISOString(),
  });
  await reload();

  const edited = f.mode === 'edit' || f.mode === 'backfill';
  if (edited) state.day = f.date;
  const label = f.mode === 'edit' ? '變更已儲存' : `已儲存　${f.slot}`;
  state.form = null;
  state.screen = edited ? 'day' : 'today';
  flash(label);
  scheduleReminders();
}

/* ── photos ──────────────────────────────────────────────────────────── */

const albumInput = document.getElementById('file-album');
const cameraInput = document.getElementById('file-camera');
const restoreInput = document.getElementById('file-restore');

async function onPhoto(input) {
  const file = input.files?.[0];
  input.value = '';
  if (!file || !state.form) return;
  const { maxDim, quality } = PHOTO_PRESET[S.photoQuality] || PHOTO_PRESET['標準'];
  try {
    state.form.photo = await U.resizeImage(file, maxDim, quality);
    render();
  } catch {
    flash('照片讀取失敗');
  }
}
albumInput.addEventListener('change', () => onPhoto(albumInput));
cameraInput.addEventListener('change', () => onPhoto(cameraInput));

/* ── export ──────────────────────────────────────────────────────────── */

const csvCell = v => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function exportCsv() {
  const head = ['日期', '星期', '餐別', '時間', '餐點', '店名', '價格', '標籤'];
  const body = state.meals.map(m => [
    m.date, U.weekdayCh(m.date), m.slot, m.time, m.title, m.place || '',
    mealPrice(m), (m.tags || []).join(' '),
  ]);
  const text = [head, ...body].map(r => r.map(csvCell).join(',')).join('\r\n');
  U.download(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }), '三餐日記.csv');
}

function exportJson() {
  const data = state.meals.map(m => ({
    date: m.date, slot: m.slot, time: m.time, title: m.title,
    place: m.place || '', price: mealPrice(m), tags: m.tags || [],
    photo: m.photo ? `${m.id}.jpg` : null,
  }));
  U.download(new Blob([JSON.stringify({ app: '三餐日記', meals: data }, null, 2)],
    { type: 'application/json' }), '三餐日記.json');
}

function exportPdf() {
  const { y, m } = state.month;
  const prefix = `${y}-${U.pad2(m + 1)}`;
  const list = state.meals.filter(x => x.date.startsWith(prefix));
  if (!list.length) return flash(`${y} 年 ${m + 1} 月沒有記錄`);

  const printRoot = document.getElementById('print-root');
  const dates = [...new Set(list.map(x => x.date))];
  printRoot.innerHTML = `<h2>三餐日記　${y} 年 ${m + 1} 月</h2>` + dates.map(date => {
    const meals = list.filter(x => x.date === date);
    return `<section class="print-day">
      <h3>${U.fmtDayFull(date)}　${cash(sum(meals))}</h3>
      ${meals.map(x => `<div class="print-meal">
        ${x.photo ? `<img alt="" src="${objUrl(x.photo)}">` : ''}
        <div>
          <strong>${U.esc(x.slot)}　${U.esc(x.time)}</strong><br>
          ${U.esc(x.title)}${x.place ? `　<span class="text-muted">${U.esc(x.place)}</span>` : ''}<br>
          ${cash(mealPrice(x))}　${(x.tags || []).map(U.esc).join('・')}
        </div>
      </div>`).join('')}
    </section>`;
  }).join('');
  printRoot.hidden = false;

  const cleanup = () => { printRoot.hidden = true; printRoot.innerHTML = ''; window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

/* ── backup / restore ────────────────────────────────────────────────── */

async function backup() {
  const meals = await Promise.all(state.meals.map(async m => ({
    ...m, photo: m.photo ? await U.blobToDataUrl(m.photo) : null,
  })));
  U.download(new Blob([JSON.stringify({ app: '三餐日記', version: 1, meals })],
    { type: 'application/json' }), `三餐日記-備份-${U.todayYmd()}.json`);
  S.lastBackup = new Date().toISOString();
  saveSettings();
  await reload();
  render();
  flash('備份檔已下載');
}

restoreInput.addEventListener('change', async () => {
  const file = restoreInput.files?.[0];
  restoreInput.value = '';
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.meals)) throw new Error('bad file');
    const meals = await Promise.all(parsed.meals.map(async m => ({
      ...m,
      id: m.id || U.uid(),
      photo: typeof m.photo === 'string' && m.photo.startsWith('data:')
        ? await U.dataUrlToBlob(m.photo) : null,
    })));
    await DB.bulkPut(meals);
    await reload();
    render();
    flash(`已還原 ${meals.length} 筆記錄`);
  } catch {
    flash('備份檔格式不正確');
  }
});

/* ── reminders ───────────────────────────────────────────────────────── */

let timer = null;
function scheduleReminders() {
  clearTimeout(timer);
  timer = null;
  const r = S.reminder;
  if (!r.on || !('Notification' in window) || Notification.permission !== 'granted') return;

  const at = new Date();
  const [h, mi] = r.time.split(':').map(Number);
  const when = new Date(at.getFullYear(), at.getMonth(), at.getDate(), h, mi, 0, 0);
  if (when <= at) when.setDate(when.getDate() + 1);
  timer = setTimeout(() => {
    const logged = mealsOn(U.todayYmd());
    const missing = U.SLOTS.filter(s => !logged.some(m => m.slot === s));
    /* Nothing to write down means nothing worth interrupting for. */
    if (missing.length) new Notification('睡前記一下', { body: `今天還沒記錄${missing.join('、')}。` });
    scheduleReminders();
  }, when - at);
}

async function toggleReminder() {
  const r = S.reminder;
  r.on = !r.on;
  saveSettings();
  render();
  if (r.on && 'Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  scheduleReminders();
  if (r.on && 'Notification' in window && Notification.permission !== 'granted') {
    flash('瀏覽器未允許通知，提醒不會跳出');
  }
}

/* ── sample data ─────────────────────────────────────────────────────── */

const SAMPLE = {
  早餐: [['蛋餅、無糖豆漿', 55, '路口早餐店', ['外帶']],
        ['吐司夾蛋、紅茶', 50, '路口早餐店', ['外帶']],
        ['麥片牛奶', 35, '家', ['自煮']],
        ['飯糰、豆漿', 60, '全聯', ['外帶']]],
  午餐: [['鮭魚定食', 180, '和食 いち・信義店', ['外食', '日式']],
        ['牛肉麵', 160, '老張牛肉麵', ['外食', '麵食', '湯品']],
        ['雞腿便當', 110, '八方雲集', ['外食']],
        ['豚骨拉麵', 220, '一風堂', ['外食', '日式', '麵食']]],
  晚餐: [['家常炒青菜、白飯', 50, '家', ['自煮', '與家人']],
        ['咖哩飯', 75, '家', ['自煮', '與家人']],
        ['壽司拼盤', 260, '和食 いち・信義店', ['外食', '日式']],
        ['泡麵加蛋', 38, '家', ['自煮']]],
  點心: [['珍珠奶茶', 65, '五十嵐', ['甜點']],
        ['起司蛋糕', 90, '轉角咖啡', ['甜點']]],
};

async function seed() {
  // A deterministic pseudo-random walk so the sample looks lived-in but
  // regenerates identically.
  let s = 20260810;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const chance = { 早餐: 0.8, 午餐: 0.95, 晚餐: 0.75, 點心: 0.25 };
  const recs = [];

  for (let back = 20; back >= 0; back--) {
    const date = U.ymd(U.addDays(new Date(), -back));
    for (const slot of U.ALL_SLOTS) {
      if (rnd() > chance[slot]) continue;
      const pool = SAMPLE[slot];
      const [title, price, place, tags] = pool[Math.floor(rnd() * pool.length) % pool.length];
      recs.push({
        id: U.uid(), date, slot, time: U.DEFAULT_TIME[slot],
        title, price, place, tags: [...tags], photo: null,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  await DB.bulkPut(recs);
  await reload();
  render();
  flash(`已載入 ${recs.length} 筆範例記錄`);
}

/* ── storage figure ──────────────────────────────────────────────────── */

async function refreshStorage() {
  if (!navigator.storage?.estimate) return;
  try {
    const { usage } = await navigator.storage.estimate();
    state.storageText = usage ? `${(usage / 1048576).toFixed(1)} MB` : '';
  } catch { /* unsupported — the row just omits the figure */ }
}

/* ── actions ─────────────────────────────────────────────────────────── */

const ACTIONS = {
  go: arg => go(arg),
  // The day screen is reachable from today, month and search, and an
  // edit round-trip lands back on it — remember where it was opened from.
  back: () => go(state.screen === 'day' ? (state.dayFrom || 'today')
                                        : (state.prev === 'add' ? 'today' : state.prev)),

  'open-day': arg => {
    state.day = arg;
    if (state.screen !== 'day') state.dayFrom = state.screen === 'add' ? 'today' : state.screen;
    go('day');
  },
  add: arg => openAdd(arg),
  'add-quick': () => openAdd(S.autoSlot ? U.slotForNow() : '午餐'),
  snack: () => openAdd(U.SNACK),
  backfill: (arg, el) => openForm('backfill', {
    slot: arg, date: el.dataset.date, time: U.DEFAULT_TIME[arg],
  }),
  edit: arg => {
    const rec = state.meals.find(m => m.id === arg);
    if (rec) openForm('edit', { rec });
  },

  'cancel-form': () => { state.form = null; go(state.prev === 'add' ? 'today' : state.prev); },
  'save-form': () => saveForm(),
  'pick-slot': arg => { state.form.slot = arg; render(); },
  'pick-place': arg => { state.form.place = arg; render(); },
  'toggle-tag': arg => {
    const t = state.form.tags;
    const i = t.indexOf(arg);
    i < 0 ? t.push(arg) : t.splice(i, 1);
    render();
  },
  'photo-camera': () => cameraInput.click(),
  'photo-album': () => albumInput.click(),

  'ask-delete': () => askDelete(state.form.id, `${state.form.slot}・${state.form.title || '這筆記錄'}`),
  'ask-delete-id': arg => {
    const rec = state.meals.find(m => m.id === arg);
    if (rec) askDelete(rec.id, `${rec.slot}・${rec.title}`);
  },
  'dialog-close': () => { state.dialog = null; render(); },
  'dialog-confirm': () => {
    const d = state.dialog;
    state.dialog = null;
    render();
    d?.onConfirm?.();
  },

  'month-step': arg => {
    const m = state.month.m + Number(arg);
    state.month = { y: state.month.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    render();
  },
  'set-range': arg => { state.range = arg; render(); },
  'filter-tag': arg => {
    const i = state.filterTags.indexOf(arg);
    i < 0 ? state.filterTags.push(arg) : state.filterTags.splice(i, 1);
    render();
  },

  'toggle-reminder': () => toggleReminder(),
  'cycle-pref': arg => {
    const p = PREFS[arg];
    S[arg] = p.values[(p.values.indexOf(S[arg]) + 1) % p.values.length];
    saveSettings();
    render();
  },
  'set-export': arg => { S.exportFmt = arg; saveSettings(); render(); },
  'do-export': () => ({ CSV: exportCsv, JSON: exportJson, PDF: exportPdf }[S.exportFmt]()),

  backup: () => backup(),
  restore: () => restoreInput.click(),
  sync: () => flash('雲端同步需要帳號伺服器，這個版本只儲存在本機'),

  seed: () => confirmDialog('載入範例資料？', '會在最近三週加入示範記錄，你現有的記錄不受影響。', '載入', seed),
  wipe: () => confirmDialog('清除所有資料？', '所有記錄與照片都會刪除，無法復原。', '清除', async () => {
    await DB.clear();
    await reload();
    await refreshStorage();
    render();
    flash('已清除所有資料');
  }),
};

function confirmDialog(title, body, confirm, onConfirm) {
  state.dialog = { title, body, confirm, onConfirm };
  render();
}

function askDelete(id, label) {
  confirmDialog(`刪除「${label}」？`, '照片與價格會一併移除，無法復原。', '刪除', async () => {
    await DB.del(id);
    await reload();
    state.form = null;
    state.screen = 'day';
    render();
    flash(`已刪除　${label}`);
  });
}

phone.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || !phone.contains(el)) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el.dataset.arg, el);
});

/* ── status bar clock ────────────────────────────────────────────────── */

const clockEl = document.getElementById('clock');
const statusDayEl = document.getElementById('status-day');
function tick() {
  clockEl.textContent = U.hm();
  statusDayEl.textContent = U.weekdayCh(U.todayYmd());
}
tick();
setInterval(tick, 20000);

/* ── boot ────────────────────────────────────────────────────────────── */

await reload();
await refreshStorage();
render();
scheduleReminders();
