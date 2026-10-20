import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildImportFailureToast,
  buildImportValidationToast,
  parseImportFile,
} from './importValidation.js';

test('import validation accepts a JSON rows array', () => {
  assert.deepEqual(parseImportFile(JSON.stringify([{ a: 1 }, { a: 2 }])), {
    format: 'JSON', view: null, count: 2,
  });
});

test('import validation accepts a JSON object with rows and view', () => {
  assert.deepEqual(
    parseImportFile(JSON.stringify({ view: 'Groups', rows: [{ a: 1 }] })),
    { format: 'JSON', view: 'Groups', count: 1 },
  );
});

test('import validation accepts CSV with a header and data rows', () => {
  assert.deepEqual(parseImportFile('login,name\n1,Alice\n2,Bob\n'), {
    format: 'CSV', view: null, count: 2,
  });
});

test('import validation rejects empty, row-less and header-only files', () => {
  assert.throws(() => parseImportFile('   \n  '), /file is empty/);
  assert.throws(() => parseImportFile(JSON.stringify({ view: 'Groups' })), /no rows array/);
  assert.throws(() => parseImportFile('login,name\n'), /header row and at least one data row/);
  assert.throws(() => parseImportFile('{not-json'));
});

test('validation success toast states nothing was imported with a neutral tone', () => {
  const toast = buildImportValidationToast({ format: 'CSV', view: null, count: 2 }, 'groups.csv');
  assert.match(toast.title, /validat/i);
  assert.match(toast.title, /nothing imported/i);
  assert.match(toast.description, /validation only/i);
  assert.match(toast.description, /no data was imported/i);
  assert.equal(toast.tone, 'info');
  assert.notEqual(toast.tone, 'success');
});

test('validation failure toast is unchanged', () => {
  const toast = buildImportFailureToast('bad.csv', new Error('file is empty'));
  assert.deepEqual(toast, {
    title: 'Import failed',
    description: 'bad.csv: file is empty',
    tone: 'danger',
  });
});

test('AuthenticatedApp validate-only flow never toasts success and names the non-import', () => {
  const appSrc = readFileSync(new URL('../AuthenticatedApp.jsx', import.meta.url), 'utf8');
  const utilSrc = readFileSync(new URL('./importValidation.js', import.meta.url), 'utf8');
  assert.match(appSrc, /from '\.\/utils\/importValidation'/);
  assert.match(appSrc, /buildImportValidationToast\(summary, f\.name\)/);
  assert.match(appSrc, /buildImportFailureToast\(f\.name, err\)/);
  assert.doesNotMatch(appSrc, /Import validated/);
  assert.match(utilSrc, /nothing imported/i);
  assert.match(utilSrc, /validation only, no data was imported/i);
  assert.match(utilSrc, /tone: 'info'/);
  assert.doesNotMatch(utilSrc, /tone: 'success'/);
});

test('File menu label stays validate-only accurate', () => {
  const menuSrc = readFileSync(
    new URL('../components/organisms/MenuBar.jsx', import.meta.url),
    'utf8',
  );
  assert.match(menuSrc, /label="Validate file \(no import\)"/);
  assert.doesNotMatch(menuSrc, /label="Validate import file"/);
});
