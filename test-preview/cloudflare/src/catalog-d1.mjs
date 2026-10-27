// Read-only authoritative catalog from D1. This module makes no payment calls.
export async function loadCatalog(db) {
  if (!db || typeof db.prepare !== 'function') throw new Error('D1 binding required');
  const [p,g,m,pg] = await Promise.all([
    db.prepare('SELECT id,name,base_cents,iced_cents,tax_bps,active FROM products').all(),
    db.prepare('SELECT id,name,min_selected,max_selected,included_count,active FROM modifier_groups').all(),
    db.prepare('SELECT id,group_id,name,price_cents,taxable,active FROM modifiers').all(),
    db.prepare('SELECT product_id,group_id FROM product_groups').all()
  ]);
  const groups = g.results.map(row=>({id:row.id,name:row.name,min:row.min_selected,max:row.max_selected,included:row.included_count,active:row.active===1,options:m.results.filter(x=>x.group_id===row.id).map(x=>({id:x.id,name:x.name,priceCents:x.price_cents,taxable:x.taxable===1,active:x.active===1}))}));
  const products = p.results.map(row=>({id:row.id,name:row.name,baseCents:row.base_cents,icedCents:row.iced_cents,taxBps:row.tax_bps,active:row.active===1,groupIds:pg.results.filter(x=>x.product_id===row.id).map(x=>x.group_id)}));
  return {products,groups};
}
