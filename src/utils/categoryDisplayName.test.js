import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryDisplayName} from './categoryDisplayName.js';

test('symbol category and dropdown labels include parent names without changing stored names', () => {
  const categories=[{id:1,name:'Forex'},{id:2,name:'Major',parentId:1,path:'Forex/Major'},{id:3,name:'Premium',parent_id:2}];
  assert.equal(categoryDisplayName({symbol:'EURUSD',category:'Major',category_id:2},categories),'Forex Major');
  assert.equal(categoryDisplayName(categories[1],categories),'Forex Major');
  assert.equal(categoryDisplayName('Premium',categories),'Forex Major Premium');
  assert.equal(categories[1].name,'Major');
});
test('root categories and catalogue paths render correctly', () => {
  assert.equal(categoryDisplayName('Forex'),'Forex');
  assert.equal(categoryDisplayName('Crypto/Coins'),'Crypto Coins');
  assert.equal(categoryDisplayName({name:'Major',path:'Forex/Major'}),'Forex Major');
});
