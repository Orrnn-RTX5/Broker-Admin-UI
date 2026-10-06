import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Buffer} from 'node:buffer';
import {categoryPayload, sessionPayload, commissionPayload, leveragePayload, swapFreePayload, depthPayload, visibilityPayload} from './symbolManagementContracts.js';

test('session requests preserve multiple intervals, overnight windows and 24:00; omit empty days', () => {
  const interval = {day_of_week:1, quoteStart:'09:00',quoteEnd:'12:00',tradeStart:'09:30',tradeEnd:'11:30'};
  const rows = sessionPayload([interval, {...interval,quoteStart:'13:00',quoteEnd:'24:00',tradeStart:'13:00',tradeEnd:'24:00'}, {day_of_week:2}]);
  assert.equal(rows.length,2);
  assert.deepEqual(rows[0],{day_of_week:1,quote_from:'09:00',quote_to:'12:00',trade_from:'09:30',trade_to:'11:30'});
  assert.equal(rows[1].trade_to,'00:00');
  assert.throws(() => sessionPayload([{...interval,quoteEnd:''}]), /Complete/);
  assert.throws(() => sessionPayload([{...interval,tradeStart:'25:00'}]), /Complete/);
});
test('category, commission and leverage use backend types and field names', () => {
  assert.equal(categoryPayload({parentId:'7'}).parentId,7);
  assert.throws(() => categoryPayload({parentId:'Forex'}));
  assert.deepEqual(commissionPayload({symbol:'EURUSD',name:'standard',commissionType:'percent',value:2,min_volume:1,max_volume:5}),{symbol:'EURUSD',name:'standard',commission_type:'percent',value:2,min_volume:1,max_volume:5});
  assert.deepEqual(leveragePayload({symbol:'EURUSD',leverage:100,volumeFrom:5,volumeTo:10}),{symbol:'EURUSD',leverage:100,volume_from:5,volume_to:10});
  assert.throws(() => leveragePayload({symbol:'EURUSD',leverage:100,volumeFrom:5,volumeTo:5}));
});
test('swap free, depth and visibility preserve actual settings without silent defaults', () => {
  const swap={group_name:'Islamic',symbol_pattern:'*',swap_free:true,charge_fee:true,fee_per_lot:3,max_holding_days:10};
  assert.deepEqual(swapFreePayload(swap),swap);
  const depth={symbol:'EURUSD',depth_levels:7,spread_markup:3,volume_filter:0.5,aggregation:'price',enabled:false};
  assert.deepEqual(depthPayload(depth),depth);
  assert.deepEqual(visibilityPayload({group:'Standard',symbols:['EURUSD','BTC*','EURUSD']}),{group:'Standard',symbols:['EURUSD','BTC*']});
  assert.deepEqual(visibilityPayload({group:'Standard',symbols:[]}),{group:'Standard',symbols:[]});
  assert.throws(() => visibilityPayload({group:'Standard',symbol:'EURUSD',visible:false}));
});
test('actual service wrappers send matching session arrays and POST deletion requests', async () => {
  const contractsUrl = new URL('./symbolManagementContracts.js',import.meta.url).href;
  const source=readFileSync(new URL('../services/api.js',import.meta.url),'utf8')
    .replace("import apiClient from './apiClient';", 'const apiClient={post:(url,data)=>({method:"POST",url,data}),get:url=>({method:"GET",url})};')
    .replace('../utils/symbolManagementContracts.js',contractsUrl);
  const api=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const row={day_of_week:0,quoteStart:'00:00',quoteEnd:'24:00',tradeStart:'00:00',tradeEnd:'24:00'};
  assert.deepEqual(api.symbolSessionSet({symbol:'EUR/USD',sessions:[row]}),{method:'POST',url:'/SymbolSessionSet?symbol=EUR%2FUSD',data:sessionPayload([row])});
  assert.deepEqual(api.sessionOverrideSet({symbol:'EURUSD',group:'Real'},[row]).data,sessionPayload([row]));
  for (const name of ['symbolCategoryDelete','sessionOverrideDelete','dynamicLeverageDelete','commissionScheduleDelete','swapFreeGroupDelete','symbolMappingDelete']) assert.equal(api[name](7).method,'POST');
});
test('actual response normalization and selector keep all allowed symbols and session times',async () => {
  const shapes=new URL('./apiShapes.js',import.meta.url).href;
  const rowsUrl=new URL('../components/organisms/SymbolManagement/symbolRows.js',import.meta.url).href;
  const source=readFileSync(new URL('../components/organisms/SymbolManagement/symbolManagementData.js',import.meta.url),'utf8')
    .replace(/import \{ InstrumentsService \}[^\n]+/, 'const InstrumentsService={getAllowedInstruments:async()=>({data:[{symbol:"EURUSD",configurationStatus:"Configured"},{symbol:"ETHUSD",configurationStatus:"Setup required"}]})};')
    .replace(/import \{ loadLpSymbols \}[^\n]+/, 'const loadLpSymbols=async()=>[{symbol:"EURUSD",configured:true},{symbol:"ETHUSD",configured:false}];')
    .replace('../../../utils/apiShapes',shapes)
    .replace('./symbolRows',rowsUrl);
  const helpers=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  assert.equal((await helpers.loadSymbolOptions()).length,2);
  const row={day_of_week:1,quote_from:'09:00:00',quote_to:'24:00:00',trade_from:'10:00:00',trade_to:'23:00:00'};
  assert.equal(helpers.normalizeSessionRows([row])[0].quoteEnd,'24:00:00');
  assert.equal(helpers.normalizeOverrideRows([row])[0].tradeStart,'10:00:00');
  assert.deepEqual(sessionPayload(helpers.normalizeSessionRows([row])),[{...row,quote_to:'00:00'}]);
});
