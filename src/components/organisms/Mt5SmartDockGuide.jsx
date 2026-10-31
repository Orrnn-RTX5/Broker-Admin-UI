import { useCallback, useEffect, useId, useRef, useState } from 'react';

/**
 * MT5 Smart Docking Icon (matches MetaTrader 5 Manager docking guide buttons)
 * direction: 'left' | 'right' | 'bottom' | 'top' | 'outer-left'
 */
function Mt5DockButtonIcon({ direction, active }) {
  const uid = useId().replace(/:/g, '');
  const normalizedDir = direction === 'outer-left' ? 'left' : direction;
  const gradId = `mt5-dock-pane-${direction}-${uid}`;
  const headerGradId = `mt5-dock-hdr-${direction}-${uid}`;

  return (
    <svg
      width="24"
      height="22"
      viewBox="0 0 24 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: 'block', pointerEvents: 'none' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={active ? '#b8d4fe' : '#d2e3fc'} />
          <stop offset="100%" stopColor={active ? '#7daef8' : '#a6c5f7'} />
        </linearGradient>
        <linearGradient id={headerGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5b8ce0" />
          <stop offset="100%" stopColor="#3566b8" />
        </linearGradient>
      </defs>

      {/* Outer miniature window background */}
      <rect
        x="1.5"
        y="1.5"
        width="21"
        height="19"
        rx="1"
        fill="#ffffff"
        stroke={active ? '#1d4ed8' : '#4a6596'}
        strokeWidth="1"
      />

      {/* Shaded target half */}
      {normalizedDir === 'left' && (
        <rect x="2" y="5.5" width="10" height="14.5" fill={`url(#${gradId})`} />
      )}
      {normalizedDir === 'right' && (
        <rect x="12" y="5.5" width="10" height="14.5" fill={`url(#${gradId})`} />
      )}
      {normalizedDir === 'bottom' && (
        <rect x="2" y="13" width="20" height="7" fill={`url(#${gradId})`} />
      )}
      {normalizedDir === 'top' && (
        <rect x="2" y="5.5" width="20" height="7.5" fill={`url(#${gradId})`} />
      )}

      {/* Top blue window header bar */}
      <rect x="2" y="2" width="20" height="3.5" fill={`url(#${headerGradId})`} />

      {/* Dotted split line + directional arrow */}
      {(normalizedDir === 'left' || normalizedDir === 'right') && (
        <line
          x1="12"
          y1="5.5"
          x2="12"
          y2="20"
          stroke="#4a6596"
          strokeWidth="1"
          strokeDasharray="1.5 1.5"
        />
      )}
      {(normalizedDir === 'bottom' || normalizedDir === 'top') && (
        <line
          x1="2"
          y1="13"
          x2="22"
          y2="13"
          stroke="#4a6596"
          strokeWidth="1"
          strokeDasharray="1.5 1.5"
        />
      )}

      {normalizedDir === 'left' && (
        <polygon points="14,13 17.5,10 17.5,16" fill="#244785" />
      )}
      {normalizedDir === 'right' && (
        <polygon points="10,13 6.5,10 6.5,16" fill="#244785" />
      )}
      {normalizedDir === 'bottom' && (
        <polygon points="12,11.8 9,8.5 15,8.5" fill="#244785" />
      )}
      {normalizedDir === 'top' && (
        <polygon points="12,14.2 9,17.5 15,17.5" fill="#244785" />
      )}
    </svg>
  );
}

const getButtonStyle = (isHovered) => ({
  width: 32,
  height: 32,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: isHovered
    ? 'linear-gradient(180deg, #ffffff 0%, #dce8fc 100%)'
    : 'linear-gradient(180deg, #f7f9fc 0%, #dcdfe6 100%)',
  border: isHovered ? '1px solid #2563eb' : '1px solid #8c96a8',
  borderRadius: 2,
  boxShadow: isHovered
    ? '0 0 0 2px rgba(37, 99, 235, 0.45), 0 4px 10px rgba(0, 0, 0, 0.35)'
    : 'inset 0 1px 0 #ffffff, 0 2px 6px rgba(0, 0, 0, 0.32)',
  cursor: 'pointer',
  pointerEvents: 'all',
  outline: 'none',
  transition: 'transform 80ms ease, border-color 80ms ease, box-shadow 80ms ease',
  transform: isHovered ? 'scale(1.06)' : 'scale(1)',
});

function readStationaryGuideAnchor() {
  if (typeof document === 'undefined') {
    return { left: 24, top: 184 };
  }
  const dockEl = document.querySelector('.admin-market-dock') || document.querySelector('.admin-workspace-upper');
  const rect = dockEl?.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) {
    return {
      left: Math.round(rect.left + 24),
      top: Math.round(rect.top + 121),
    };
  }
  return { left: 24, top: 184 };
}

export default function Mt5SmartDockGuide({
  activePanelId,
  onSelectPlacement,
  onDismiss,
}) {
  const [hoveredZone, setHoveredZone] = useState(null);
  const hoveredZoneRef = useRef(null);
  const guideRootRef = useRef(null);
  const handledActionRef = useRef(false);

  const updateHovered = useCallback((zone) => {
    hoveredZoneRef.current = zone;
    setHoveredZone(zone);
  }, []);

  const commitPlacement = useCallback((zone) => {
    if (!activePanelId || !zone || handledActionRef.current) return;
    handledActionRef.current = true;
    updateHovered(null);
    onSelectPlacement?.(activePanelId, zone);
    setTimeout(() => {
      handledActionRef.current = false;
    }, 0);
  }, [activePanelId, onSelectPlacement, updateHovered]);

  useEffect(() => {
    handledActionRef.current = false;
    hoveredZoneRef.current = null;
    setHoveredZone(null);
  }, [activePanelId]);

  useEffect(() => {
    if (!activePanelId) return undefined;

    const resolveZoneAtPoint = (clientX, clientY) => {
      const root = guideRootRef.current;
      if (!root) return null;
      const buttons = root.querySelectorAll('[data-mt5-dock-zone]');
      for (const btn of buttons) {
        const rect = btn.getBoundingClientRect();
        if (
          clientX >= rect.left - 3 &&
          clientX <= rect.right + 3 &&
          clientY >= rect.top - 3 &&
          clientY <= rect.bottom + 3
        ) {
          return btn.getAttribute('data-mt5-dock-zone');
        }
      }
      return null;
    };

    const handleWindowMouseMove = (event) => {
      const zone = resolveZoneAtPoint(event.clientX, event.clientY);
      if (zone !== hoveredZoneRef.current) {
        updateHovered(zone);
      }
    };

    const handleWindowMouseUp = (event) => {
      const zone = resolveZoneAtPoint(event.clientX, event.clientY) || hoveredZoneRef.current;
      if (zone) {
        commitPlacement(zone);
      }
    };

    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (guideRootRef.current?.contains(target)) return;
      if (target.closest('[data-dock-titlebar="true"]')) return;
      onDismiss?.();
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onDismiss?.();
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove, true);
    window.addEventListener('mouseup', handleWindowMouseUp, true);
    window.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove, true);
      window.removeEventListener('mouseup', handleWindowMouseUp, true);
      window.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePanelId, commitPlacement, onDismiss, updateHovered]);

  if (!activePanelId) return null;

  const { left: anchorLeft, top: anchorTop } = readStationaryGuideAnchor();

  const bindZoneEvents = (zone) => ({
    'data-mt5-dock-zone': zone,
    onMouseEnter: () => updateHovered(zone),
    onMouseLeave: () => updateHovered(null),
    onMouseDown: (e) => e.stopPropagation(),
    onMouseUp: (e) => {
      e.stopPropagation();
      e.preventDefault();
      commitPlacement(zone);
    },
    onClick: (e) => {
      e.stopPropagation();
      e.preventDefault();
      commitPlacement(zone);
    },
  });

  return (
    <div
      ref={guideRootRef}
      data-testid="mt5-smart-dock-guide"
      data-active-panel={activePanelId || ''}
      aria-label="MT5 Smart Docking Guide"
      style={{
        position: 'fixed',
        left: anchorLeft,
        top: anchorTop,
        width: 158,
        height: 92,
        zIndex: 99999,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {/* Far-left outer dock button */}
      <button
        type="button"
        aria-label="Dock to outer left"
        title="Dock to far left"
        style={{
          ...getButtonStyle(hoveredZone === 'outer-left'),
          position: 'absolute',
          left: 0,
          top: 22,
        }}
        {...bindZoneEvents('outer-left')}
      >
        <Mt5DockButtonIcon direction="outer-left" active={hoveredZone === 'outer-left'} />
      </button>

      {/* Main MT5 cross/diamond cluster */}
      <div
        style={{
          position: 'absolute',
          left: 54,
          top: 0,
          width: 100,
          height: 90,
          pointerEvents: 'none',
        }}
      >
        <svg
          width="100"
          height="90"
          viewBox="0 0 100 90"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            filter: 'drop-shadow(0 3px 8px rgba(0, 0, 0, 0.42))',
            pointerEvents: 'none',
          }}
        >
          <defs>
            <linearGradient id="mt5-diamond-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#dfe3ea" />
            </linearGradient>
          </defs>
          <polygon
            points="50,2 72,22 96,22 96,54 68,54 68,86 32,86 32,54 4,54 4,22 28,22"
            fill="url(#mt5-diamond-bg)"
            stroke="#9099a8"
            strokeWidth="1"
          />
          <polygon
            points="50,6 66,21 34,21"
            fill={hoveredZone === 'top' ? '#cfe0fc' : '#f1f4f9'}
            stroke="#b8c0ce"
            strokeWidth="0.8"
          />
        </svg>

        <button
          type="button"
          aria-label="Dock above (Top)"
          title="Dock to top"
          style={{
            position: 'absolute',
            left: 32,
            top: 2,
            width: 36,
            height: 20,
            padding: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            pointerEvents: 'all',
          }}
          {...bindZoneEvents('top')}
        />

        <button
          type="button"
          aria-label="Dock to left column"
          title="Dock to left"
          style={{
            ...getButtonStyle(hoveredZone === 'left'),
            position: 'absolute',
            left: 4,
            top: 22,
          }}
          {...bindZoneEvents('left')}
        >
          <Mt5DockButtonIcon direction="left" active={hoveredZone === 'left'} />
        </button>

        <button
          type="button"
          aria-label="Dock to right column"
          title="Dock to right"
          style={{
            ...getButtonStyle(hoveredZone === 'right'),
            position: 'absolute',
            left: 64,
            top: 22,
          }}
          {...bindZoneEvents('right')}
        >
          <Mt5DockButtonIcon direction="right" active={hoveredZone === 'right'} />
        </button>

        <button
          type="button"
          aria-label="Dock below (Bottom)"
          title="Dock to bottom"
          style={{
            ...getButtonStyle(hoveredZone === 'bottom'),
            position: 'absolute',
            left: 34,
            top: 52,
          }}
          {...bindZoneEvents('bottom')}
        >
          <Mt5DockButtonIcon direction="bottom" active={hoveredZone === 'bottom'} />
        </button>
      </div>
    </div>
  );
}
