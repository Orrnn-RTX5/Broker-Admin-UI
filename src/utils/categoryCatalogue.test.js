import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryCatalogue} from './categoryCatalogue.js';
import {allowedInstruments} from './allowedInstruments.js';

test('symbol filters include saved and catalogue categories with exact membership', () => {
  const folders = categoryCatalogue([
    {id: 1, name: 'Forex'},
    {id: 2, name: 'Major', path: 'Forex/Major', parent_id: 1},
    {id: 3, name: 'Custom category'},
  ], [
    {symbol: 'AUDUSD', category: 'Forex'},
    {symbol: 'USDJPY', category: 'Forex/Major'},
    {symbol: 'EURUSD', category: 'Major', category_id: 2},
    {symbol: 'BTCUSD', category: 'Crypto'},
    {symbol: 'ETHUSD', category: 'crypto'},
    {symbol: 'XAUUSD', category: 'Metals'},
    {symbol: 'NEW', category: 'New feed category'},
  ]);
  assert.deepEqual(folders.map(row => row.name), ['Crypto', 'Custom category', 'Forex', 'Major', 'Metals', 'New feed category']);
  assert.deepEqual(folders.find(row => row.name === 'Crypto').symbols.map(row => row.symbol), ['BTCUSD', 'ETHUSD']);
  assert.deepEqual(folders.find(row => row.id === 2).symbols.map(row => row.symbol), ['EURUSD', 'USDJPY']);
  assert.equal(folders.find(row => row.id === 2).parentKey, 'saved:1');
});

test('categories without database IDs have distinct filter keys and do not absorb unrelated symbols', () => {
  const folders = categoryCatalogue([{name: 'Forex'}, {name: 'Empty'}], [
    {symbol: 'EURUSD', category: 'Forex'},
    {symbol: 'BTCUSD', category: 'Crypto'},
  ]);
  assert.equal(new Set(folders.map(row => row.key)).size, 3);
  assert.equal(folders.find(row => row.name === 'Empty').symbols.length, 0);
  assert.deepEqual(folders.find(row => row.name === 'Crypto').symbols.map(row => row.symbol), ['BTCUSD']);
});

test('empty category table still shows all ten allowed symbols with setup status', () => {
  const catalogue=['EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','BTCUSD','ETHUSD','SOLUSD','XAUUSD','XAGUSD'];
  const configured=['EURUSD','GBPUSD','USDJPY','BTCUSD','XAUUSD','XAGUSD','EURJPY'].map(symbol=>({symbol,enabled:true}));
  const folders=categoryCatalogue([],allowedInstruments(catalogue,configured).data);
  assert.deepEqual(folders.map(row=>[row.name,row.symbols.length]),[['Crypto',3],['Forex',5],['Metals',2]]);
  assert.equal(folders.flatMap(row=>row.symbols).filter(row=>row.configurationStatus==='Setup required').length,4);
  assert.ok(folders.every(row=>row.isVirtual && !row.id));
  assert.ok(!folders.flatMap(row=>row.symbols).some(row=>row.symbol==='EURJPY'));
});
test('saved folders retain hierarchy and disabled symbols without duplicate inferred categories',()=>{
  const folders=categoryCatalogue([{id:1,name:'Forex',path:'Forex'},{id:2,name:'Majors',path:'Forex/Majors',parentId:1},{id:3,name:'Empty',enabled:false}],
    [{symbol:'EURUSD',category:'Forex/Majors',enabled:false,configurationStatus:'Configured'},{symbol:'GBPUSD',category:'forex'}]);
  assert.equal(folders.length,3);
  assert.equal(folders.find(row=>row.id===2).parentKey,'saved:1');
  assert.equal(folders.find(row=>row.id===2).symbols[0].enabled,false);
  assert.equal(folders.find(row=>row.id===1).symbols.length,1);
  assert.equal(folders.find(row=>row.id===3).enabled,false);
});
test('orphaned and cyclic folders remain reachable from a root',()=>{
  const folders=categoryCatalogue([{id:1,name:'A',parentId:2},{id:2,name:'B',parentId:1},{id:3,name:'C',parentId:99}],[]);
  for(const node of folders){
    const visited=new Set(); let current=node;
    while(current){assert.ok(!visited.has(current.key));visited.add(current.key);current=folders.find(row=>row.key===current.parentKey);}
  }
  assert.equal(folders.find(row=>row.id===3).parentKey,null);
});
