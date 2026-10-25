// Keep search and observing-time behavior independent of the browser UI.
export const normalizeSkyQuery = value =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s・座]/g, '')
    .replace(/[\u30a1-\u30f6]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60));

export function tonightValue(now, offset) {
  const local = new Date(now.getTime() + offset * 3600000);
  return local.toISOString().slice(0, 10) + 'T21:00:00';
}

export function rangeLabel(id, value) {
  const n = Number(value);
  if (['speed', 'volume', 'artOpacity'].includes(id)) return `${Math.round(n * 100)}%`;
  if (['tourInterval', 'narrationGap'].includes(id)) return `${n}秒`;
  if (id === 'fov') return `${Math.round(n)}°`;
  if (['light', 'speechRate'].includes(id)) return `${n.toFixed(2).replace(/0$/, '')}倍`;
  return String(n);
}
