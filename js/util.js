/* Dates, money, slots and image helpers. */

export const SLOTS = ['早餐', '午餐', '晚餐'];
export const SNACK = '點心';
export const ALL_SLOTS = [...SLOTS, SNACK];
export const SEG_LABELS = [['早', '早餐'], ['午', '午餐'], ['晚', '晚餐'], ['點心', SNACK]];
export const DEFAULT_TIME = { 早餐: '08:00', 午餐: '12:00', 晚餐: '19:00', 點心: '15:00' };
export const BASE_TAGS = ['外食', '自煮', '外帶', '日式', '麵食', '湯品', '甜點', '與家人'];

const WEEK_CH = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_CH = ['一月', '二月', '三月', '四月', '五月', '六月',
                  '七月', '八月', '九月', '十月', '十一月', '十二月'];
const CURRENCY = { TWD: '$', JPY: '¥', USD: 'US$' };

export const pad2 = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayYmd = () => ymd(new Date());
export const hm = (d = new Date()) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export const fmtDay = s => { const d = parseYmd(s); return `${d.getMonth() + 1} 月 ${d.getDate()} 日`; };
export const weekdayCh = s => `星期${WEEK_CH[parseYmd(s).getDay()]}`;
export const fmtDayFull = s => `${fmtDay(s)}　${weekdayCh(s)}`;
export const monthCh = m => MONTH_CH[m];
export const dowLabels = startDay => Array.from({ length: 7 }, (_, i) => WEEK_CH[(startDay + i) % 7]);

export const money = (n, cur = 'TWD') =>
  (CURRENCY[cur] || '$') + Math.round(n || 0).toLocaleString('en-US');

export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

/** Monday- or Sunday-anchored start of the week containing `date`. */
export function weekStartOf(date, startDay) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return addDays(d, -((d.getDay() - startDay + 7) % 7));
}

/** Which meal a timestamp most likely belongs to. */
export function slotForNow(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h < 11) return '早餐';
  if (h < 15) return '午餐';
  if (h < 22) return '晚餐';
  return SNACK;
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Downscale + re-encode a picked photo so a diary of them still fits on disk. */
export function resizeImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob(b => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('read failed')); };
    img.src = url;
  });
}

export const blobToDataUrl = b => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(b);
});

export const dataUrlToBlob = async u => (await fetch(u)).blob();

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
