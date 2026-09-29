import test from 'node:test';
import assert from 'node:assert/strict';
import {nativePendingAccountTarget} from './nativePendingAccountTarget.js';
const input=permissions=>({selected:{type:'account',viewType:'Trading Accounts',row:{raw:{login:'9007199254740993'}}},activeView:'Trading Accounts',accountView:true,canView:true,user:{permissions},scope:'manager:broker:session'});
test('view-only and independent trade rights reach native controls without account editing',()=>{
 const view=nativePendingAccountTarget(input(['view_accounts']));assert.equal(view.login,'9007199254740993');assert.equal(view.canPlace,false);assert.equal(view.canCancel,false);
 const place=nativePendingAccountTarget(input(['view_accounts','manage_trades']));assert.equal(place.canPlace,true);assert.equal(place.canCancel,true);
 const cancel=nativePendingAccountTarget(input(['view_accounts','close_positions']));assert.equal(cancel.canPlace,false);assert.equal(cancel.canCancel,true);
});
test('revoked view, unauthenticated scope and stale/nonaccount selections cannot open a dialog',()=>{
 const base=input(['view_accounts','manage_trades']);
 for(const patch of [{scope:''},{canView:false},{accountView:false},{activeView:'Groups'},{user:{permissions:['manage_trades']}},{selected:{...base.selected,type:'trade'}}])assert.equal(nativePendingAccountTarget({...base,...patch}),null);
 const original=nativePendingAccountTarget(base);assert.notEqual(nativePendingAccountTarget({...base,scope:'other-session'}).key,original.key);
 assert.notEqual(nativePendingAccountTarget({...base,selected:{...base.selected,row:{login:'1002'}}}).key,original.key);
});
test('ambiguous or unsafe numeric selected identities fail closed',()=>{
 for(const row of [{login:9007199254740993},{login:['1001']},{login:'0'},{login:'9223372036854775808'},{raw:{login:'1001'},login:'1002'}])assert.equal(nativePendingAccountTarget({...input(['view_accounts']),selected:{type:'account',viewType:'Trading Accounts',row}}),null);
});
