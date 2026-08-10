/* Preferences and reminder config — small and synchronous, so localStorage. */

const KEY = 'sancan.settings';

const DEFAULTS = () => ({
  reminders: {
    早餐: { on: true, time: '08:00' },
    午餐: { on: true, time: '12:00' },
    晚餐: { on: false, time: '19:00' },
  },
  autoSlot: true,        // pick the meal slot from the clock when adding
  photoQuality: '標準',
  currency: 'TWD',
  weekStart: 1,          // 1 = Monday, 0 = Sunday
  exportFmt: 'CSV',
  lastBackup: null,
});

export const PHOTO_PRESET = {
  標準: { maxDim: 1280, quality: 0.82 },
  高:   { maxDim: 2048, quality: 0.92 },
};

function load() {
  const base = DEFAULTS();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...base, ...saved, reminders: { ...base.reminders, ...(saved.reminders || {}) } };
  } catch {
    return base;
  }
}

export const S = load();

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch { /* private mode / quota — settings just won't persist */ }
}
