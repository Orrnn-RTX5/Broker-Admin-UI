import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('named connection transport uses existing bearer client, revision paths and logon-only body', async () => {
  const calls = [];
  globalThis.__lpAdminTestAPI = Object.fromEntries(['get','put','post'].map(method => [method,async (...args) => { calls.push([method,...args]); return {data:{ok:true}}; }]));
  try {
    const source = (await readFile(new URL('./lpConnections.service.js', import.meta.url),'utf8')).replace("import { api } from '../lib/api.js';",'const api = globalThis.__lpAdminTestAPI;');
    const client = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    await client.listLPConnections();
    await client.saveLPConnection({expected_revision:0,config:{id:'a',revision:0}});
    await client.saveLPConnection({expected_revision:2,config:{id:'a',revision:2}});
    await client.enableLPConnection({id:'a',revision:2},true);
    await client.testLPConnection('a');
    assert.deepEqual(calls.map(call => [call[0],call[1]]),[
      ['get','/api/v1/manager/lp-connections'],['post','/api/v1/manager/lp-connections'],['put','/api/v1/manager/lp-connections/a'],['post','/api/v1/manager/lp-connections/a/enable'],['post','/api/v1/manager/lp-connections/a/test']]);
    assert.deepEqual(calls[3][2],{expected_revision:2,enabled:true});
    assert.deepEqual(calls[4][2],{});
    for (const call of calls) assert.deepEqual(call.at(-1),{_noRetry:true});
  } finally { delete globalThis.__lpAdminTestAPI; }
});
