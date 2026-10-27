import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCatalog} from '../src/catalog-d1.mjs';
import {priceOrder} from '../src/pricing.mjs';

const tables={
 products:[{id:'latte',name:'Latte',base_cents:700,iced_cents:700,tax_bps:825,active:1}],
 modifier_groups:[{id:'flavor',name:'Flavor',min_selected:0,max_selected:2,included_count:0,active:1}],
 modifiers:[{id:'caramel',group_id:'flavor',name:'Caramel',price_cents:100,taxable:1,active:1}],
 product_groups:[{product_id:'latte',group_id:'flavor'}],
};
tables.catalog_revision=[{revision:7}];
const db={async batch(stmts){return Promise.all(stmts.map(s=>s.all()))},prepare(sql){const match=sql.match(/FROM\s+(products|modifier_groups|modifiers|product_groups|catalog_revision)/i);if(!match)throw Error('Unexpected query');return {async all(){return {results:tables[match[1]].map(x=>({...x}))}}}}};

test('Loads D1-owned price and modifier metadata',async()=>{
 const catalog=await loadCatalog(db);
 assert.equal(catalog.products[0].baseCents,700);
 assert.equal(catalog.products[0].taxBps,825);
 assert.equal(catalog.groups[0].options[0].priceCents,100);
 const priced=priceOrder({items:[{productId:'latte',quantity:1,modifierIds:['caramel'],temperature:'Iced',baseCents:1,discountCents:9999}]},catalog);
 assert.equal(priced.subtotalCents,800);
 assert.equal(priced.taxCents,66);
 assert.equal(priced.totalCents,866);
});
test('Rejects missing D1 binding',async()=>{await assert.rejects(loadCatalog(null),/D1 binding required/)});

