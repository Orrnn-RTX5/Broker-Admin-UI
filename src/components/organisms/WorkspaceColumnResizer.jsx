import { useEffect, useRef, useState } from 'react';

export default function WorkspaceColumnResizer({ label, value, min, max, onResize, onReset }) {
  const drag = useRef(null);
  const latestResize = useRef(onResize);
  const [dragging, setDragging] = useState(false);

  useEffect(() => { latestResize.current = onResize; }, [onResize]);
  useEffect(() => () => drag.current?.cleanup(), []);

  const startDrag = event => {
    if (event.button !== 0 || drag.current) return;
    event.preventDefault();
    const element = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = value;
    const cursor = document.body.style.cursor;
    const userSelect = document.body.style.userSelect;
    const move = next => {
      if (next.pointerId === pointerId) latestResize.current(startWidth + next.clientX - startX);
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      element.removeEventListener('lostpointercapture', cancel);
      drag.current = null;
      if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
      document.body.style.cursor = cursor;
      document.body.style.userSelect = userSelect;
    };
    const cancel = () => { cleanup(); setDragging(false); };
    const finish = next => {
      if (next.pointerId !== pointerId) return;
      move(next);
      cancel();
    };
    drag.current = { cleanup };
    element.setPointerCapture(pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    setDragging(true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    element.addEventListener('lostpointercapture', cancel);
  };

  return (
    <div
      className={`workspace-column-resizer ${dragging ? 'is-dragging' : ''}`}
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} pixels`}
      tabIndex={0}
      title="Drag left or right to resize. Double-click to reset."
      onPointerDown={startDrag}
      onDoubleClick={onReset}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          onResize(value + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 40 : 10));
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          onResize(event.key === 'Home' ? min : max);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          onReset();
        }
      }}
    />
  );
}
