export const deterministicRatio = (...parts) => {
  const input = parts.map((part) => String(part)).join('|');
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
};
export const deterministicInt = (min, max, ...parts) => {
  const lower = Number(min);
  const upper = Number(max);
  return Math.floor(deterministicRatio(...parts) * (upper - lower + 1)) + lower;
};
