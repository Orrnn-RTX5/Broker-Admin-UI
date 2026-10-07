export const DOCK_WIDTH_LIMITS = Object.freeze({
  marketWatch: { min: 180, max: 600 },
  navigator: { min: 160, max: 480 },
});

export function defaultDockWidths(viewportWidth) {
  if (viewportWidth >= 1600) return { marketWatch: 330, navigator: 220 };
  if (viewportWidth <= 1100) return { marketWatch: 220, navigator: 190 };
  return { marketWatch: 290, navigator: 210 };
}

export function dockWidthRange(panel, widths, availableWidth, collapsed) {
  const other = panel === 'marketWatch' ? 'navigator' : 'marketWatch';
  const { min, max } = DOCK_WIDTH_LIMITS[panel];
  const otherWidth = collapsed[other] ? 32 : widths[other];
  // Leave enough room for the active view and its controls.
  return { min, max: Math.max(min, Math.min(max, availableWidth - 281 - otherWidth)) };
}

export function resizeDockPanel(panel, requested, widths, availableWidth, collapsed) {
  const { min, max } = dockWidthRange(panel, widths, availableWidth, collapsed);
  return { ...widths, [panel]: Math.round(Math.max(min, Math.min(max, requested))) };
}

export function fitDockWidths(widths, availableWidth, collapsed) {
  const bounded = Object.fromEntries(Object.entries(widths).map(([panel, width]) => {
    const { min, max } = DOCK_WIDTH_LIMITS[panel];
    return [panel, Math.max(min, Math.min(max, width))];
  }));
  // Fit the Navigator first, then Market Watch, when the window becomes smaller.
  const next = resizeDockPanel('navigator', bounded.navigator, bounded, availableWidth, collapsed);
  return resizeDockPanel('marketWatch', next.marketWatch, next, availableWidth, collapsed);
}
