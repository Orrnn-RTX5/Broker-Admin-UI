import test from 'node:test';
import assert from 'node:assert/strict';
import { caseConflictExistingName, checkServerNameConflict, createGuardRefusal, exactParentGroup, findGroupNameCaseConflict, groupCreateConflictFromError, groupNameConflictFromAvailability, isPaddedParent, paddedNewNameRefusal, parentLookupPending, parentRecordMatches, resolveParentGroup, validateGroupForm, validateGroupSection } from './groupFormSteps.js';
import { groupCreateBody } from './groupAuthority.js';

const complete = { name: 'Broker/real', currency: 'USD', leverage: 100, spreadMarkup: 0, commissionRate: 0, marginCallLevel: 100, stopOutLevel: 50, symbolsAllowed: '' };
test('General requires a meaningful name and currency', () => {
  assert.equal(validateGroupSection({ ...complete, name: '  ' }, 'details').field, 'name');
  assert.equal(validateGroupSection({ ...complete, currency: '' }, 'details').field, 'currency');
  assert.equal(validateGroupSection(complete, 'details'), null);
});
test('Trading blocks invalid leverage, blank amounts, and negative fees before advancing', () => {
  for (const value of [0, -1, 1.5, '', 'bad']) assert.equal(validateGroupSection({ ...complete, leverage: value }, 'trading').field, 'leverage');
  assert.equal(validateGroupSection({ ...complete, commissionRate: '' }, 'trading').field, 'commissionRate');
  assert.equal(validateGroupSection({ ...complete, spreadMarkup: -1 }, 'trading').field, 'spreadMarkup');
});
test('Risk rejects missing or negative thresholds and accepts zero', () => {
  assert.equal(validateGroupSection({ ...complete, marginCallLevel: '' }, 'risk').field, 'marginCallLevel');
  assert.equal(validateGroupSection({ ...complete, stopOutLevel: -1 }, 'risk').field, 'stopOutLevel');
  assert.equal(validateGroupSection({ ...complete, stopOutLevel: 0 }, 'risk'), null);
});
test('Final validation rechecks earlier sections while preserving optional symbols', () => {
  assert.equal(validateGroupForm(complete), null);
  assert.equal(validateGroupForm({ ...complete, leverage: -1 }).section, 'trading');
  assert.equal(validateGroupForm({ ...complete, stopOutLevel: '' }).section, 'risk');
});
test('a new group name that differs from an existing group only by letter case or spaces is refused', () => {
  const existing = ['Orrnn/demo-std', 'Arijit'];
  const message = "A group named 'Orrnn/demo-std' already exists (names differ only in letter case or spaces)";
  assert.deepEqual(validateGroupSection({ ...complete, name: 'orrnn/demo-std' }, 'details', existing), { section: 'details', field: 'name', message });
  assert.equal(validateGroupSection({ ...complete, name: ' Arijit2 ' }, 'details', existing), null, 'an unrelated name passes');
  assert.equal(validateGroupSection({ ...complete, name: ' ARIJIT ' }, 'details', existing).message, "A group named 'Arijit' already exists (names differ only in letter case or spaces)");
  assert.equal(validateGroupForm({ ...complete, name: 'orrnn/DEMO-STD' }, existing).field, 'name');
  assert.equal(validateGroupForm({ ...complete, name: 'Fresh' }, existing), null);
});
test('an exact existing name is not a case conflict here (the server decides), but a variant beside it still is', () => {
  assert.equal(findGroupNameCaseConflict('Arijit', ['Arijit']), null, 'exact only: the server decides between a broker duplicate and a shared exact name');
  assert.equal(findGroupNameCaseConflict('Arijit', ['Arijit', 'arijit']), 'arijit', 'a case variant is refused even when the exact name is also listed');
  assert.equal(findGroupNameCaseConflict('Arijit', ['Arijit ', 'Arijit']), 'Arijit ', 'a space variant is refused too');
  assert.equal(findGroupNameCaseConflict('Arijit', []), null);
  assert.equal(validateGroupSection({ ...complete, name: 'arijit' }, 'details'), null, 'no loaded list: the server still checks');
  assert.equal(findGroupNameCaseConflict('   ', ['Arijit']), null);
});
test('several existing spellings name the first in code-unit order, like the server', () => {
  assert.equal(findGroupNameCaseConflict('ABC', ['abc', 'Abc']), 'Abc');
});
test('the server availability answer is a conflict only for a case-variant reason with the existing name', () => {
  assert.equal(groupNameConflictFromAvailability({ group: 'ABC', exists: false, available: false, reason: 'GROUP_NAME_CASE_CONFLICT', existing: 'abc' }), 'abc');
  assert.equal(groupNameConflictFromAvailability({ group: 'abc', exists: true }), null, 'an exact name answers exists with no reason');
  assert.equal(groupNameConflictFromAvailability({ group: 'x', exists: false, available: true }), null);
  assert.equal(groupNameConflictFromAvailability({ group: 'x', exists: false, available: false, reason: 'GROUP_ALREADY_EXISTS', existing: 'x' }), null, 'a duplicate reason is the server duplicate rule');
  assert.equal(groupNameConflictFromAvailability({ available: false, reason: 'GROUP_NAME_CASE_CONFLICT' }), null, 'no existing name: not a usable conflict');
  assert.equal(groupNameConflictFromAvailability(null), null);
});

test('a padded parent is sent and looked up exactly; a blank parent means no parent', () => {
  assert.equal(exactParentGroup('Main/parent '), 'Main/parent ');
  assert.equal(exactParentGroup(' Main/parent'), ' Main/parent');
  assert.equal(exactParentGroup('Main/parent'), 'Main/parent');
  assert.equal(exactParentGroup('   '), '');
  assert.equal(exactParentGroup(undefined), '');
});

test('the create body carries the exact parent name (the server-side trim is a separate, backend fix)', () => {
  const validated = { name: 'Main/parent /child', currency: 'USD' };
  assert.equal(groupCreateBody(validated, exactParentGroup('Main/parent '), ['parentGroup']).parentGroup, 'Main/parent ');
  assert.equal(groupCreateBody(validated, exactParentGroup('Main/parent'), ['parentGroup']).parentGroup, 'Main/parent');
  assert.equal(groupCreateBody(validated, exactParentGroup('   '), []).parentGroup, null, 'blank is a root group: no parent is sent');
});

test('a parent lookup fills the form only from the exact parent record', () => {
  assert.equal(parentRecordMatches({ name: 'Main/parent ' }, 'Main/parent '), true);
  assert.equal(parentRecordMatches({ name: 'Main/parent' }, 'Main/parent '), false, 'the unpadded twin never fills a padded parent');
  assert.equal(parentRecordMatches({ name: 'Main/parent ' }, 'Main/parent'), false);
  assert.equal(parentRecordMatches({ name: 'main/parent' }, 'Main/parent'), false, 'a case twin never fills');
  assert.equal(parentRecordMatches({ group: 'Main/parent' }, 'Main/parent'), false, 'the answer must name the record');
  assert.equal(parentRecordMatches(null, 'Main/parent'), false);
  assert.equal(parentRecordMatches({ name: 'Main/parent' }, '   '), false);
});

test('both server wordings of the case conflict name the existing spelling; other errors are not a conflict', () => {
  assert.equal(caseConflictExistingName("a group named 'Arijit' already exists (names differ only in letter case or spaces)"), 'Arijit');
  assert.equal(caseConflictExistingName("a group named 'Arijit' already exists (names differ only by letter case)"), 'Arijit');
  const envelope = (message) => ({ response: { data: { code: 'GROUP_NAME_CASE_CONFLICT', message } } });
  assert.deepEqual(groupCreateConflictFromError(envelope("a group named 'Arijit' already exists (names differ only by letter case)")), { existing: 'Arijit' });
  assert.deepEqual(groupCreateConflictFromError(envelope("a group named 'Arijit' already exists (names differ only in letter case or spaces)")), { existing: 'Arijit' });
  assert.deepEqual(groupCreateConflictFromError({ response: { data: { code: 'GROUP_NAME_CASE_CONFLICT' } } }), { existing: null }, 'a conflict with no name is still a conflict');
  assert.equal(groupCreateConflictFromError({ response: { data: { code: 'GROUP_ALREADY_EXISTS', message: "a group named 'Arijit' already exists" } } }), null);
  assert.equal(groupCreateConflictFromError({ response: { data: { message: 'Group create failed' } } }), null);
  assert.equal(groupCreateConflictFromError(new Error('Network Error')), null);
});

test('the name probe is best-effort and fail-open: a 404, a 5xx or an unexpected answer never blocks the create', async () => {
  const notFound = Object.assign(new Error('Request failed with status code 404'), { response: { status: 404, data: { code: 'MT_RET_ERR_NOTFOUND' } } });
  assert.equal(await checkServerNameConflict(async () => { throw notFound; }), null, 'a 404 is no conflict; GroupCreate decides');
  assert.equal(await checkServerNameConflict(async () => { throw new Error('Request failed with status code 500'); }), null);
  assert.equal(await checkServerNameConflict(async () => undefined), null);
  assert.equal(await checkServerNameConflict(async () => ({ group: 'x', exists: true })), null, 'an exact name is decided by GroupCreate');
  assert.equal(await checkServerNameConflict(async () => ({ available: false, reason: 'GROUP_NAME_CASE_CONFLICT', existing: 'Arijit' })), 'Arijit');
});

test('a typed parent is accepted only when it is exactly a listed group; anything else is refused with the Manager wording', () => {
  const listed = ['Main/parent', 'Main/parent ', 'Other'];
  assert.deepEqual(resolveParentGroup('', listed, 'ready'), { status: 'none', name: '', suggestion: null, message: '' });
  assert.deepEqual(resolveParentGroup('Main/parent', listed, 'ready'), { status: 'exact', name: 'Main/parent', suggestion: null, message: '' });
  assert.equal(resolveParentGroup('Main/parent ', listed, 'ready').status, 'padded', 'X1: a padded name is refused even when it is itself listed');
  assert.deepEqual(resolveParentGroup('Main/Parent', listed, 'ready'), { status: 'missing', name: '', suggestion: null, message: "Parent group 'Main/Parent' not found." }, 'a case twin is not a parent');
  assert.deepEqual(resolveParentGroup('Other ', ['Other'], 'ready'), { status: 'padded', name: '', suggestion: null, message: 'Parent group names with surrounding spaces are not supported (read-only legacy group)' }, 'X1: a padded entry is refused with no suggestion');
  assert.equal(resolveParentGroup('Ghost', [], 'ready').message, "Parent group 'Ghost' not found.", 'a loaded empty list means not found');
  assert.equal(resolveParentGroup('Dup ', ['Dup', 'Dup'], 'ready').suggestion, null, 'two identical listed names: no single suggestion');
});

test('while the group list is loading or has failed, no typed parent is accepted, and it is not called "not found"', () => {
  assert.deepEqual(resolveParentGroup('Main/parent', ['Main/parent'], 'loading'), { status: 'loading', name: '', suggestion: null, message: 'Group list loading…' }, 'even an exact listed name is refused until the list is loaded');
  assert.deepEqual(resolveParentGroup('Main/parent', ['Main/parent'], 'failed'), { status: 'failed', name: '', suggestion: null, message: 'Group list failed: Retry' });
  assert.equal(resolveParentGroup('', [], 'loading').status, 'none', 'a blank parent needs no list');
});

test('the form refuses a parent that is not an exact listed group, in the General section, and accepts the exact one', () => {
  const complete = { name: 'Main/parent /child', currency: 'USD', leverage: 100, spreadMarkup: 0, commissionRate: 0, marginCallLevel: 100, stopOutLevel: 50, symbolsAllowed: '' };
  const missing = resolveParentGroup('Main/parent ', ['Main/parent'], 'ready');
  assert.deepEqual(validateGroupSection(complete, 'details', ['Main/parent'], missing), { section: 'details', field: 'parentGroup', message: 'Parent group names with surrounding spaces are not supported (read-only legacy group)' });
  assert.equal(validateGroupForm(complete, ['Main/parent'], missing).field, 'parentGroup');
  assert.equal(validateGroupSection(complete, 'details', ['Main/parent'], resolveParentGroup('Main/parent', ['Main/parent'], 'ready')), null);
  assert.equal(validateGroupSection(complete, 'details', [], resolveParentGroup('', [], 'failed')), null, 'no parent: the list is irrelevant');
  assert.equal(validateGroupSection(complete, 'details', ['Main/parent'], resolveParentGroup('Main/parent', ['Main/parent'], 'loading')).message, 'Group list loading…');
  assert.equal(validateGroupSection(complete, 'details', ['Main/parent'], null), null, 'an edit passes no parent state');
});

test('the create guard runs the form and parent rules before any request, and the name probe only after they pass', async () => {
  const complete = { name: 'Main/parent /child', currency: 'USD', leverage: 100, spreadMarkup: 0, commissionRate: 0, marginCallLevel: 100, stopOutLevel: 50, symbolsAllowed: '' };
  const probes = [];
  const probe = async () => { probes.push('probe'); return { group: 'x', exists: false, available: true }; };
  const guard = (overrides = {}) => createGuardRefusal({ form: complete, existingGroupNames: ['Main/parent'], parentGroup: 'Main/parent', parentStatus: 'ready', probe, ...overrides });
  assert.equal(await guard(), null, 'an exact parent and a clean probe let the create go to GroupCreate');
  assert.deepEqual(probes, ['probe']);

  probes.length = 0;
  const missingParent = await guard({ parentGroup: 'Main/parent ' });
  assert.equal(missingParent.field, 'parentGroup', 'a padded non-listed parent is refused');
  assert.equal(probes.length, 0, 'no request is made for a refused parent');

  const loading = await guard({ parentStatus: 'loading' });
  assert.equal(loading.message, 'Group list loading…');
  assert.equal(probes.length, 0);

  const blankName = await guard({ form: { ...complete, name: '   ' } });
  assert.equal(blankName.field, 'name');
  assert.equal(probes.length, 0, 'an invalid form makes no request either');

  const conflict = await guard({ probe: async () => ({ available: false, reason: 'GROUP_NAME_CASE_CONFLICT', existing: 'Arijit' }) });
  assert.deepEqual(conflict, { section: 'details', field: 'name', message: "A group named 'Arijit' already exists (names differ only in letter case or spaces)" });

  assert.equal(await guard({ probe: async () => { throw Object.assign(new Error('404'), { response: { status: 404 } }); } }), null, 'a 404 probe lets GroupCreate decide');
  assert.equal(await guard({ parentGroup: '', existingGroupNames: [] }), null, 'a root create needs no list');
});
test('the server case-conflict answer names the existing spelling', () => {
  assert.equal(caseConflictExistingName("a group named 'Arijit' already exists (names differ only by letter case)"), 'Arijit');
  assert.equal(caseConflictExistingName('Group create failed'), null);
});

test('X1: a parent with a leading or trailing space is refused on create, in every list state, even when the padded name is listed', async () => {
  assert.equal(isPaddedParent('Main/parent '), true);
  assert.equal(isPaddedParent(' Main/parent'), true);
  assert.equal(isPaddedParent('Main/parent'), false);
  assert.equal(isPaddedParent('   '), false, 'blank is no parent, not a padded one');
  assert.equal(isPaddedParent(undefined), false);
  const listed = ['Main/parent', 'Main/parent '];
  for (const status of ['ready', 'loading', 'failed']) {
    const padded = resolveParentGroup('Main/parent ', listed, status);
    assert.equal(padded.status, 'padded', `padded in the ${status} list state`);
    assert.equal(padded.message, 'Parent group names with surrounding spaces are not supported (read-only legacy group)');
  }
  assert.equal(resolveParentGroup(' Main/parent', ['Main/parent'], 'ready').status, 'padded');
  const complete = { name: 'Main/parent /child', currency: 'USD', leverage: 100, spreadMarkup: 0, commissionRate: 0, marginCallLevel: 100, stopOutLevel: 50, symbolsAllowed: '' };
  assert.equal(validateGroupSection(complete, 'details', listed, resolveParentGroup('Main/parent ', listed, 'ready')).field, 'parentGroup');
  const refusal = await createGuardRefusal({ form: complete, existingGroupNames: listed, parentGroup: 'Main/parent ', parentStatus: 'ready', probe: async () => { throw new Error('the probe must not run for a refused parent'); } });
  assert.equal(refusal.field, 'parentGroup', 'the create is refused before any request');
  assert.equal(resolveParentGroup('Main/parent', listed, 'ready').status, 'exact', 'the unpadded exact parent still passes');
});

test('A-R5-11: a parent lookup is pending only for an exact, unpadded parent, so a padded or blank entry never holds the form', () => {
  assert.equal(parentLookupPending('Main/parent'), true);
  assert.equal(parentLookupPending('Main/parent '), false, 'a padded entry runs no lookup');
  assert.equal(parentLookupPending('   '), false, 'a blank entry runs no lookup');
  assert.equal(parentLookupPending(''), false);
  assert.equal(parentLookupPending(undefined), false);
});


// Round 7 (A-R6-5): a padded NEW group name is refused, never trimmed; the case fold and the candidate trim spaces only.
test('A-R6-5: a padded new group name is refused, never trimmed; the message matches the Manager wording', async () => {
  assert.deepEqual(paddedNewNameRefusal(' Main '), { section: 'details', field: 'name', message: 'Group names with surrounding spaces are not supported' });
  assert.equal(paddedNewNameRefusal('Main'), null);
  assert.equal(paddedNewNameRefusal('   '), null, 'a blank name is the empty-name rule, not the padded one');
  const complete = { name: ' Main ', currency: 'USD', leverage: 100, spreadMarkup: 0, commissionRate: 0, marginCallLevel: 100, stopOutLevel: 50, symbolsAllowed: '' };
  const refusal = await createGuardRefusal({ form: complete, existingGroupNames: [], parentGroup: '', parentStatus: 'ready', probe: async () => { throw new Error('the probe must not run for a padded name'); } });
  assert.equal(refusal.message, 'Group names with surrounding spaces are not supported');
});

test('the case fold and the candidate trim spaces only: a tab is part of a name, as on the server', () => {
  assert.equal(findGroupNameCaseConflict('Foo', ['Foo\t']), null, 'Foo-tab is a different name from Foo on the server');
  assert.equal(findGroupNameCaseConflict('Foo', ['foo']), 'foo');
});
