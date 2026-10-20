// Parent-level Escape handling for stacked popups (SUI-A2). A dialog rendered
// inside another popup (e.g. FundingPopup inside Account Edit) marks its root
// with data-nested-popup="true". While such a nested popup is open, the
// parent-level Escape handler must stand down so Esc does not close the
// parent underneath it.

export const NESTED_POPUP_SELECTOR = '[data-nested-popup="true"]';

/** True when a nested popup marker exists under root. DOM-free testable. */
export const isNestedPopupOpen = (root) => {
  try {
    return Boolean(root?.querySelector?.(NESTED_POPUP_SELECTOR));
  } catch {
    return false;
  }
};

/**
 * Whether the parent-level Escape handler may act on this key event. False
 * for non-Escape events and while a nested popup is open.
 */
export const shouldParentHandleEscape = (event) => {
  if (!event || event.key !== 'Escape') return false;
  const root = event.target?.ownerDocument ?? event.currentTarget?.ownerDocument;
  return !isNestedPopupOpen(root);
};
