import { parseNonNegativeNumber, parsePositiveInteger } from './adminValidation.js';

const NUMERIC_FIELDS = {
  trading: [['leverage', 'Leverage', parsePositiveInteger], ['spreadMarkup', 'Spread markup', parseNonNegativeNumber], ['commissionRate', 'Commission rate', parseNonNegativeNumber]],
  risk: [['marginCallLevel', 'Margin call level', parseNonNegativeNumber], ['stopOutLevel', 'Stop out level', parseNonNegativeNumber]],
};

export const validateGroupSection = (form, section) => {
  if (section === 'details') {
    if (!String(form.name ?? '').trim()) return { section, field: 'name', message: 'Enter a group name to continue.' };
    if (!String(form.currency ?? '').trim()) return { section, field: 'currency', message: 'Enter an account currency to continue.' };
  }
  for (const [field, label, parse] of NUMERIC_FIELDS[section] || []) {
    try {
      if (form[field] == null || String(form[field]).trim() === '') throw new Error(`${label} is required.`);
      parse(form[field], label);
    } catch (error) {
      return { section, field, message: error.message };
    }
  }
  return null;
};

export const validateGroupForm = (form) => {
  for (const section of ['details', 'trading', 'risk', 'symbols']) {
    const error = validateGroupSection(form, section);
    if (error) return error;
  }
  return null;
};
