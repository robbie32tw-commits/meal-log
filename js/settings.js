/* Preferences and reminder config — small and synchronous, so localStorage. */

const KEY = 'sancan.settings';

const DEFAULTS = () => ({
  /* One nightly nudge to write the day down, rather than a ping per meal. */
  reminder: { on: true, time: '22:30' },
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
    return { ...base, ...saved, reminder: { ...base.reminder, ...(saved.reminder || {}) } };
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
