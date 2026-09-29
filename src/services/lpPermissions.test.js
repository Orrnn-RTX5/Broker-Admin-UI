/* global Buffer */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('./lpPermissions.js',import.meta.url),'utf8')).replace("import { api } from '../lib/api.js';",'const api={request:()=>{throw Error("test transport required")}};');
const {createLPPermissionAdminAPI,emptyLPGrant,lpGrantPayload}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('grants require explicit view, reason and exact maximum coverage',()=>{
 const grant=emptyLPGrant();assert.equal(grant.scope.all_accounts,false);assert.deepEqual(grant.actions,[]);
 grant.actions=['configuration'];assert.throws(()=>lpGrantPayload('0',grant,'fixture'),/Inspection/);
 grant.actions=['view','configuration'];grant.max_coverage_percent='200.000000000000000001';assert.equal(lpGrantPayload('9007199254740993',grant,'fixture').grant.max_coverage_percent,'200.000000000000000001');
 assert.throws(()=>lpGrantPayload('0',grant,''),/reason/);
});
test('grant and revoke target existing identities and preserve revision without elevation headers',async()=>{
 const calls=[];const api=createLPPermissionAdminAPI(async options=>{calls.push(options);return{data:{revision:'2'}};});const manager={login:'101',revision:'9007199254740993'};
 await api.save(manager,{...emptyLPGrant(),actions:['view']},'synthetic reason');await api.revoke(manager,'revoke reason');
 assert.equal(calls[0].url,'/api/v1/manager/lp-permissions/managers/101');assert.equal(calls[0].method,'PUT');assert.equal(calls[0].data.expected_revision,'9007199254740993');assert.equal(calls[0].headers,undefined);assert.equal(calls[0]._noRetry,true);
 assert.equal(calls[1].url,'/api/v1/manager/lp-permissions/managers/101/revoke');assert.equal('grant' in calls[1].data,false);
});
test('cleanup_recovery is a known grant action that still requires view and rejects unknown or duplicate actions',()=>{
 const grant=emptyLPGrant();
 grant.actions=['view','cleanup_recovery'];assert.deepEqual(lpGrantPayload('3',grant,'recovery holder').grant.actions,['view','cleanup_recovery']);
 grant.actions=['cleanup_recovery'];assert.throws(()=>lpGrantPayload('3',grant,'recovery holder'),/Inspection/);
 for(const actions of [['view','lp_cleanup_recovery'],['view','cleanup_recovery','cleanup_recovery'],['view','admin']]){grant.actions=actions;assert.throws(()=>lpGrantPayload('3',grant,'recovery holder'),/known LP actions/);}
});
test('grant editor offers every backend action including cleanup_recovery and no longer calls demo trade test unavailable',async()=>{
 const panel=await readFile(new URL('../components/organisms/LPManagerPermissionsPanel.jsx',import.meta.url),'utf8');
 assert.match(source,/LP_GRANT_ACTIONS=\['view','connection_test','configuration','trade_test','cleanup_recovery'\]/);
 assert.match(panel,/LP_GRANT_ACTIONS\.map/);
 assert.match(panel,/cleanup_recovery:'D01 cleanup recovery requests/);
 assert.match(panel,/never implied by other actions/);
 assert.match(panel,/a platform SuperAdmin cannot/);
 assert.doesNotMatch(panel,/execution unavailable|no trade-test endpoint/);
});
