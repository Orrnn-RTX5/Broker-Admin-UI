export const CLIENT_ROW_HEIGHT = 37;
const HEADER_HEIGHT = 33;
const OVERSCAN = 5;

// The complete loaded page remains available for sorting and exporting;
// only the rows around the viewport need DOM nodes.
export const getClientRowWindow = (count, scrollTop = 0, viewportHeight = 600, { rowHeight = CLIENT_ROW_HEIGHT, headerHeight = HEADER_HEIGHT } = {}) => {
  const visibleCount = Math.ceil(Math.max(1, viewportHeight) / rowHeight) + 1;
  const firstVisible = Math.min(
    Math.max(0, count - visibleCount),
    Math.floor(Math.max(0, scrollTop - headerHeight) / rowHeight),
  );
  const start = Math.max(0, firstVisible - OVERSCAN);
  const end = Math.min(count, firstVisible + visibleCount + OVERSCAN);
  return {
    start, end,
    before: start * rowHeight,
    after: (count - end) * rowHeight,
  };
};
