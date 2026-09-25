import React from 'react';
import { useLpSymbols } from '../../hooks/useLpSymbols';
import { buildLpSymbolOptions, excludeSymbols } from '../../utils/lpSymbolLists';

/**
 * <datalist> of every LP symbol (configured instruments plus the LP catalogue)
 * for free-text symbol inputs: point the input's `list` at `id`. Symbols with
 * no configured instrument are labelled "not configured". Inputs stay free
 * text, so wildcards keep working where the backend accepts them.
 */
const LpSymbolDatalist = ({ id, exclude }) => {
  const { symbols } = useLpSymbols();
  const options = React.useMemo(() => {
    const all = buildLpSymbolOptions(symbols);
    if (!exclude || exclude.length === 0) return all;
    const allowed = new Set(excludeSymbols(all.map((option) => option.value), exclude));
    return all.filter((option) => allowed.has(option.value));
  }, [symbols, exclude]);

  return (
    <datalist id={id}>
      {options.map((option) => (
        <option key={option.value} value={option.value} label={option.label || undefined} />
      ))}
    </datalist>
  );
};

export default LpSymbolDatalist;
