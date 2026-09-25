import { groupSymbolOptions, NOT_CONFIGURED_GROUP_LABEL } from './symbolRows';

// <option>s for a symbol <select>: configured instruments first, then LP
// symbols that have no instrument yet (these tables accept any symbol).
const SymbolOptions = ({ symbols }) => {
  const { configured, unconfigured } = groupSymbolOptions(symbols);
  if (unconfigured.length === 0) {
    return configured.map((name) => <option key={name} value={name}>{name}</option>);
  }
  return (
    <>
      {configured.length > 0 && (
        <optgroup label="Configured">
          {configured.map((name) => <option key={name} value={name}>{name}</option>)}
        </optgroup>
      )}
      <optgroup label={NOT_CONFIGURED_GROUP_LABEL}>
        {unconfigured.map((name) => <option key={name} value={name}>{name} (not configured)</option>)}
      </optgroup>
    </>
  );
};

export default SymbolOptions;
