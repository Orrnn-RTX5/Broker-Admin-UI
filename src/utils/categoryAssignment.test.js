import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryCatalogue} from './categoryCatalogue.js';
import {allowedInstruments} from './allowedInstruments.js';
import {categoryCandidates,assignCategorySymbols} from './categoryAssignment.js';

function fixture(){
 const categories=[{id:1,name:'Forex'},{id:2,name:'Majors',path:'Forex/Majors',parentId:1},{id:3,name:'Crypto'},{id:4,name:'Coins',parentId:3},{id:5,name:'Metals'}];
 const instruments=allowedInstruments(['EURUSD','GBPUSD','USDJPY','AUDUSD','USDCHF','BTCUSD','ETHUSD','SOLUSD','XAUUSD','XAGUSD'],[
  {symbol:'EURUSD',category:'Majors',category_id:2,enabled:true},{symbol:'GBPUSD',category:'Forex',enabled:false},{symbol:'USDJPY',category:'Forex',enabled:true},{symbol:'BTCUSD',category:'Crypto',enabled:true},{symbol:'XAUUSD',category:'Metals',enabled:true},{symbol:'XAGUSD',category:'Metals',enabled:true}
 ]).data;
 return {instruments,folders:categoryCatalogue(categories,instruments)};
}
test('Forex subcategory offers only five Forex symbols including setup and existing assignments',()=>{
 const {folders,instruments}=fixture();const target=folders.find(row=>row.id===2);
 const rows=categoryCandidates(target,folders,instruments);
 assert.deepEqual(rows.map(row=>row.symbol),['AUDUSD','EURUSD','GBPUSD','USDCHF','USDJPY']);
 assert.equal(rows.find(row=>row.symbol==='EURUSD').alreadyAssigned,true);
 assert.equal(rows.find(row=>row.symbol==='AUDUSD').needsSetup,true);
 assert.equal(rows.find(row=>row.symbol==='GBPUSD').enabled,false);
});
test('filter follows category ancestry dynamically for Crypto and Metals',()=>{
 const {folders,instruments}=fixture();
 assert.deepEqual(categoryCandidates(folders.find(row=>row.id===4),folders,instruments).map(row=>row.symbol),['BTCUSD','ETHUSD','SOLUSD']);
 assert.deepEqual(categoryCandidates(folders.find(row=>row.id===5),folders,instruments).map(row=>row.symbol),['XAGUSD','XAUUSD']);
});
test('assignment changes only category and reports partial failures for retry',async()=>{
 const {folders,instruments}=fixture();const target=folders.find(row=>row.id===2);const rows=categoryCandidates(target,folders,instruments);const calls=[];
 const result=await assignCategorySymbols(target,rows,['GBPUSD','USDJPY'],async(symbol,body)=>{calls.push({symbol,body});if(symbol==='USDJPY')throw new Error('unavailable');});
 assert.deepEqual(calls,[{symbol:'GBPUSD',body:{category:'Majors'}},{symbol:'USDJPY',body:{category:'Majors'}}]);
 assert.deepEqual(result,{saved:['GBPUSD'],failed:[{symbol:'USDJPY',message:'unavailable'}]});
 for(const symbol of ['BTCUSD','AUDUSD','EURUSD']) await assert.rejects(assignCategorySymbols(target,rows,[symbol],async()=>assert.fail('must not write')),/not available/);
});
