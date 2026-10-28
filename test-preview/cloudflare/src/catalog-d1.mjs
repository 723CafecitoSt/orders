// Read-only authoritative catalog from D1. This module makes no payment calls.
export async function loadCatalog(db) {
  if (!db || typeof db.prepare !== 'function' || typeof db.batch !== 'function') throw new Error('D1 binding required');
  const [p,g,m,pg,rev] = await db.batch([
    db.prepare('SELECT products.id,products.name,products.base_cents,products.iced_cents,products.tax_bps,products.active,d.temperature,d.notes,d.display_station,d.seasonal,s.station FROM products LEFT JOIN product_display d ON d.product_id=products.id LEFT JOIN product_stations s ON s.product_id=products.id'),
    db.prepare('SELECT id,name,min_selected,max_selected,included_count,active FROM modifier_groups'),
    db.prepare('SELECT id,group_id,name,price_cents,taxable,active FROM modifiers'),
    db.prepare('SELECT product_id,group_id FROM product_groups'),
    db.prepare('SELECT revision FROM catalog_revision WHERE singleton=1')
  ]);
  const groups = g.results.map(row=>({id:row.id,name:row.name,min:row.min_selected,max:row.max_selected,included:row.included_count,active:row.active===1,options:m.results.filter(x=>x.group_id===row.id).map(x=>({id:x.id,name:x.name,priceCents:x.price_cents,taxable:x.taxable===1,active:x.active===1}))}));
  const products = p.results.map(row=>({id:row.id,name:row.name,baseCents:row.base_cents,icedCents:row.iced_cents,taxBps:row.tax_bps,temperature:row.temperature??null,notes:row.notes||'',displayStation:row.display_station??null,seasonal:row.seasonal===1,station:row.station??null,active:row.active===1,groupIds:pg.results.filter(x=>x.product_id===row.id).map(x=>x.group_id)}));
  if(rev.results.length!==1||!Number.isSafeInteger(rev.results[0].revision))throw Error('Catalog revision unavailable');
  return {products,groups,revision:rev.results[0].revision};
}

