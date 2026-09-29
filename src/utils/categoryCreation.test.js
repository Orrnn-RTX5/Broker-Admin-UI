import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {categoryCatalogue} from './categoryCatalogue.js';
import {categoryPath, createCategoryWithParent} from './categoryCreation.js';

test('empty database offers catalogue parents and saves parent before child with numeric ID', async()=>{
  const folders=categoryCatalogue([],['Forex','Crypto','Metals'].map((category,i)=>({category,symbol:String(i)})));
  assert.deepEqual(folders.map(row=>row.name),['Crypto','Forex','Metals']);
  const parent=folders.find(row=>row.name==='Forex');const calls=[];
  await createCategoryWithParent({name:'Majors'},parent,{list:async()=>[],create:async body=>{calls.push(body);return {id:7};}});
  assert.equal(calls[0].name,'Forex');
  assert.deepEqual(calls[1],{name:'Majors',path:'Forex/Majors',parentId:7,description:''});
});
test('retry after child failure reuses the parent already saved', async()=>{
  const rows=[];let parentCreates=0;let childAttempts=0;
  const api={list:async()=>rows,create:async body=>{
    if(body.name==='Forex'){parentCreates++; rows.push({...body,id:12}); return {id:12};}
    if(++childAttempts===1)throw new Error('child failed');return {id:13};
  }};
  const parent={name:'Forex',path:'Forex',isVirtual:true};
  await assert.rejects(createCategoryWithParent({name:'Majors'},parent,api),/child failed/);
  await createCategoryWithParent({name:'Majors'},parent,api);
  assert.equal(parentCreates,1);assert.equal(childAttempts,2);
});
test('saved parents, top-level categories and custom paths are preserved',async()=>{
  const api={create:async body=>body,list:async()=>{throw new Error('unnecessary lookup');}};
  assert.equal(categoryPath('Majors',{path:'Forex'}),'Forex/Majors');
  const result=await createCategoryWithParent({name:'Majors',path:'Custom/Majors'},{id:4,name:'Forex'},api);
  assert.equal(result.parentId,4);assert.equal(result.path,'Custom/Majors');
  assert.equal((await createCategoryWithParent({name:'Energy'},null,api)).path,'Energy');
  await assert.rejects(createCategoryWithParent({name:'Forex'},{id:4,name:'Forex'},api),/own parent/);
});
test('actual category form receives catalogue folders and selects stable keys',()=>{
  const source=readFileSync(new URL('../components/organisms/SymbolManagement/CategoriesTab.jsx',import.meta.url),'utf8');
  assert.match(source, /<CategoryFormModal[\s\S]*?allCategories=\{folders\}/);
  assert.match(source, /value=\{form.parentKey\}/);
  assert.match(source, /value=\{c.key\}/);
  assert.match(source, /createCategoryWithParent\(form, parent/);
});
