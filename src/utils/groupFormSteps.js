import { parseNonNegativeNumber } from './adminValidation.js';
import { validateGroupLeverage } from './brokerGroupDefaults.js';

const NUMERIC_FIELDS = {
  trading: [['leverage', 'Leverage', validateGroupLeverage], ['spreadMarkup', 'Spread markup', parseNonNegativeNumber], ['commissionRate', 'Commission rate', parseNonNegativeNumber]],
  risk: [['marginCallLevel', 'Margin call level', parseNonNegativeNumber], ['stopOutLevel', 'Stop out level', parseNonNegativeNumber]],
};

// Mirrors the backend rule (manager-backend handlers/group_name_case.go): a new name conflicts with an existing group whose
// name differs only by letter case or surrounding spaces. An exact existing name defers to the duplicate rule.
export const GROUP_NAME_CASE_CONFLICT_CODE = 'GROUP_NAME_CASE_CONFLICT';
// Spaces only, as the server's btrim: a tab or newline is part of a name, so it is not folded away.
const trimSpaces = (name) => String(name ?? '').replace(/^ +| +$/g, '');
const foldGroupName = (name) => trimSpaces(name).toLowerCase();

/**
 * The existing group name a new group name clashes with by case or spaces, or null. Only a spelling other than the
 * candidate is a case conflict; the server refuses any such variant, in the broker's own groups or the shared ones.
 * An exact name is not decided here: the loaded list carries no broker id, so the client cannot tell a broker-own
 * duplicate (refused by the server) from a shared exact name (allowed). Existing names are checked in code-unit order.
 */
export const findGroupNameCaseConflict = (name, existingNames = []) => {
  const candidate = trimSpaces(name);
  const folded = foldGroupName(candidate);
  if (!folded || !Array.isArray(existingNames)) return null;
  const variants = existingNames
    .filter((existing) => typeof existing === 'string' && existing !== candidate && foldGroupName(existing) === folded)
    .sort();
  return variants[0] ?? null;
};

/** The existing group a server availability answer (GroupGet?availability=1) names as a case conflict, or null. */
export const groupNameConflictFromAvailability = (answer) => (answer?.available === false
  && answer.reason === GROUP_NAME_CASE_CONFLICT_CODE
  && typeof answer.existing === 'string' && answer.existing ? answer.existing : null);

/**
 * The parent group exactly as the typed name, or '' when blank (no parent). A surrounding space is part of the name: a
 * padded parent is a different group from its unpadded twin, so the name is never trimmed before it is sent.
 */
export const exactParentGroup = (parentGroup) => {
  const exact = String(parentGroup ?? '');
  return exact.trim() ? exact : '';
};

/** True only when a GroupGet answer is the record of exactly this parent name. A twin's record never fills the form. */
export const parentRecordMatches = (record, parentGroup) => {
  const exact = exactParentGroup(parentGroup);
  return Boolean(exact) && Boolean(record) && typeof record === 'object' && record.name === exact;
};

/**
 * The create refusal for a case or space variant, from the GroupCreate error, or null for any other error. The envelope
 * code is authoritative. The existing spelling is read from the message, which the server words as "...(names differ
 * only by letter case)" and the form words as "...(names differ only in letter case or spaces)": one pattern accepts both.
 */
export const groupCreateConflictFromError = (error) => {
  if (error?.response?.data?.code !== GROUP_NAME_CASE_CONFLICT_CODE) return null;
  const data = error.response.data;
  return { existing: caseConflictExistingName(typeof data === 'string' ? data : String(data?.message ?? '')) };
};

/**
 * The best-effort name check (GroupGet?availability=1). Fail-open: a rejected or unexpected answer is no conflict, and
 * GroupCreate, which runs the same check, stays authoritative.
 */
/**
 * Every pre-request guard of a create, in order, returning the refusal ({section, field, message}) or null. The form and the
 * parent rule run first and never reach the network; then the best-effort name probe (fail-open) runs. GroupCreate stays
 * authoritative and is still sent by the caller when this returns null.
 */
export const createGuardRefusal = async ({ form, existingGroupNames = [], parentGroup = '', parentStatus = 'ready', probe }) => {
  const padded = paddedNewNameRefusal(form?.name);
  if (padded) return padded;
  const parent = resolveParentGroup(parentGroup, existingGroupNames, parentStatus);
  const validation = validateGroupForm(form, existingGroupNames, parent);
  if (validation) return validation;
  const serverConflict = await checkServerNameConflict(probe);
  if (serverConflict !== null) return { section: 'details', field: 'name', message: groupNameCaseConflictMessage(serverConflict) };
  return null;
};

export const checkServerNameConflict = async (probe) => {
  try {
    return groupNameConflictFromAvailability(await probe());
  } catch {
    return null;
  }
};

export const groupNameCaseConflictMessage = (existing) => `A group named '${existing}' already exists (names differ only in letter case or spaces)`;

/** The existing name from a server GROUP_NAME_CASE_CONFLICT message, or null when the message does not name one. */
export const caseConflictExistingName = (message) => /named '(.*)' already exists/.exec(String(message ?? ''))?.[1] ?? null;

// A-R6-5: a padded NEW group name is refused, never trimmed silently (the Manager refuses it too). Edits never rename, so this
// is checked for creates only.
export const NEW_NAME_PADDED_MESSAGE = 'Group names with surrounding spaces are not supported';
export const paddedNewNameRefusal = (name) => {
  const value = String(name ?? '');
  return value.trim() !== '' && value !== value.trim() ? { section: 'details', field: 'name', message: NEW_NAME_PADDED_MESSAGE } : null;
};

export const PADDED_PARENT_MESSAGE ='Parent group names with surrounding spaces are not supported (read-only legacy group)';

/**
 * True while a parent lookup will run: an exact, unpadded parent. A padded or blank entry runs no lookup, so it must not
 * leave the form waiting (the create submit is held while the lookup is pending).
 */
export const parentLookupPending = (typed) => exactParentGroup(typed) !== '' && !isPaddedParent(typed);

/** A typed parent with a leading or trailing space (a blank value is not padded, it is no parent). */
export const isPaddedParent = (typed) => {
  const value = String(typed ?? '');
  return value.trim() !== '' && value !== value.trim();
};

/**
 * The parent group as the form must judge it: a blank parent is no parent; a typed parent must be exactly a listed group.
 * Fail closed: while the group list is loading or has failed, a typed parent is not accepted (no guessing from a
 * partial list). A non-exact entry is refused with the Manager's wording, and a suggestion is offered only as text.
 */
export const resolveParentGroup = (typed, listedNames = [], listStatus = 'ready') => {
  const exact = exactParentGroup(typed);
  if (!exact) return { status: 'none', name: '', suggestion: null, message: '' };
  // X1: the backend still trims a parent on create, so a padded parent would attach to its unpadded twin. Padded groups are
  // read-only legacy groups: refused here whether or not the padded name is listed.
  if (isPaddedParent(exact)) return { status: 'padded', name: '', suggestion: null, message: PADDED_PARENT_MESSAGE };
  if (listStatus === 'loading') return { status: 'loading', name: '', suggestion: null, message: 'Group list loading…' };
  if (listStatus === 'failed') return { status: 'failed', name: '', suggestion: null, message: 'Group list failed: Retry' };
  const names = (Array.isArray(listedNames) ? listedNames : []).filter((name) => typeof name === 'string');
  if (names.includes(exact)) return { status: 'exact', name: exact, suggestion: null, message: '' };
  const trimmed = exact.trim();
  const matches = names.filter((name) => name === trimmed);
  const suggestion = matches.length === 1 ? matches[0] : null;
  const hint = suggestion !== null ? ` Did you mean '${suggestion}'?` : '';
  return { status: 'missing', name: '', suggestion, message: `Parent group '${String(typed)}' not found.${hint}` };
};

export const validateGroupSection = (form, section, existingGroupNames = [], parent = null) => {
  if (section === 'details') {
    if (!String(form.name ?? '').trim()) return { section, field: 'name', message: 'Enter a group name to continue.' };
    const existing = findGroupNameCaseConflict(form.name, existingGroupNames);
    if (existing !== null) return { section, field: 'name', message: groupNameCaseConflictMessage(existing) };
    if (parent && parent.status !== 'none' && parent.status !== 'exact') return { section, field: 'parentGroup', message: parent.message };
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

export const validateGroupForm = (form, existingGroupNames = [], parent = null) => {
  for (const section of ['details', 'trading', 'risk', 'symbols']) {
    const error = validateGroupSection(form, section, existingGroupNames, parent);
    if (error) return error;
  }
  return null;
};
