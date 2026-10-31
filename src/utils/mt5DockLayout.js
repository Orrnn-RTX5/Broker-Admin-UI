export const MT5_DOCK_MODES = Object.freeze({
  ROW: 'row',
  COLUMN: 'column',
});

export const MT5_DOCK_PANELS = Object.freeze({
  MARKET_WATCH: 'marketWatch',
  NAVIGATOR: 'navigator',
});

export const DEFAULT_MT5_DOCK_ARRANGEMENT = Object.freeze({
  mode: MT5_DOCK_MODES.ROW,
  order: Object.freeze([MT5_DOCK_PANELS.MARKET_WATCH, MT5_DOCK_PANELS.NAVIGATOR]),
  floatingPanel: null,
  terminalFullWidth: true,
  floatRects: Object.freeze({
    [MT5_DOCK_PANELS.MARKET_WATCH]: Object.freeze({ x: 24, y: 148, width: 228, height: 380 }),
    [MT5_DOCK_PANELS.NAVIGATOR]: Object.freeze({ x: 24, y: 148, width: 228, height: 380 }),
  }),
});

export function createInitialMt5DockArrangement() {
  return {
    mode: DEFAULT_MT5_DOCK_ARRANGEMENT.mode,
    order: [...DEFAULT_MT5_DOCK_ARRANGEMENT.order],
    floatingPanel: null,
    terminalFullWidth: true,
    floatRects: {
      [MT5_DOCK_PANELS.MARKET_WATCH]: { ...DEFAULT_MT5_DOCK_ARRANGEMENT.floatRects[MT5_DOCK_PANELS.MARKET_WATCH] },
      [MT5_DOCK_PANELS.NAVIGATOR]: { ...DEFAULT_MT5_DOCK_ARRANGEMENT.floatRects[MT5_DOCK_PANELS.NAVIGATOR] },
    },
  };
}

/**
 * Applies an MT5 Smart Docking Guide placement ('outer-left', 'left', 'right', 'bottom', 'top')
 * to `marketWatch` or `navigator`.
 */
export function applyMt5DockPlacement(current, panelId, placement) {
  const safeCurrent = current || createInitialMt5DockArrangement();
  const target = panelId === MT5_DOCK_PANELS.NAVIGATOR
    ? MT5_DOCK_PANELS.NAVIGATOR
    : MT5_DOCK_PANELS.MARKET_WATCH;
  const sibling = target === MT5_DOCK_PANELS.MARKET_WATCH
    ? MT5_DOCK_PANELS.NAVIGATOR
    : MT5_DOCK_PANELS.MARKET_WATCH;

  if (placement === 'outer-left') {
    return {
      ...safeCurrent,
      mode: MT5_DOCK_MODES.ROW,
      order: [target, sibling],
      floatingPanel: null,
      terminalFullWidth: true,
    };
  }

  if (placement === 'left') {
    return {
      ...safeCurrent,
      mode: MT5_DOCK_MODES.ROW,
      order: [target, sibling],
      floatingPanel: null,
      terminalFullWidth: false,
    };
  }

  if (placement === 'right') {
    return {
      ...safeCurrent,
      mode: MT5_DOCK_MODES.ROW,
      order: [sibling, target],
      floatingPanel: null,
      terminalFullWidth: false,
    };
  }

  if (placement === 'bottom') {
    return {
      ...safeCurrent,
      mode: MT5_DOCK_MODES.COLUMN,
      order: [sibling, target],
      floatingPanel: null,
      terminalFullWidth: false,
    };
  }

  if (placement === 'top') {
    return {
      ...safeCurrent,
      mode: MT5_DOCK_MODES.COLUMN,
      order: [target, sibling],
      floatingPanel: null,
      terminalFullWidth: false,
    };
  }

  return {
    ...safeCurrent,
    floatingPanel: null,
  };
}
