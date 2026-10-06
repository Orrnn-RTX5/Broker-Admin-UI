import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('./PrivateFIXReadinessPanel.jsx',import.meta.url),'utf8');

test('readiness is broker-wide, read only and shows derived codes only',()=>{
 assert.doesNotMatch(src,/connectionID|connection_id|connectionId/);
 assert.doesNotMatch(src,/<input|<form|localStorage|sessionStorage/);
 assert.match(src,/PRIVATE_FIX_CODES\[view\.last_error_code\]/);
 assert.match(src,/const session=useAuthStore/);
});

test('mounted once in GatewaysView beside the capability registry',()=>{
 const view=readFileSync(new URL('./GatewaysView.jsx',import.meta.url),'utf8');
 assert.equal(view.match(/<PrivateFIXReadinessPanel \/>/g)?.length,1);
 assert.equal(view.match(/<BrokerCapabilitiesPanel \/>/g)?.length,1);
 assert.match(view,/<PrivateFIXReadinessPanel \/><BrokerCapabilitiesPanel \/>/);
 assert.match(view,/import PrivateFIXReadinessPanel from '\.\/PrivateFIXReadinessPanel\.jsx';/);
 assert.match(view,/import BrokerCapabilitiesPanel from '\.\/BrokerCapabilitiesPanel\.jsx';/);
});
