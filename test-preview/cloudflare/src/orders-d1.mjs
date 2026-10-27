// Test-only storage primitives. These functions are not exposed by the locked Worker.
import {loadCatalog} from './catalog-d1.mjs';
import {priceOrder} from './pricing.mjs';
const idOk=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{8,64}$/.test(x);
export async function createOrder(db,{id,employeeId,request,now}){
 if(!idOk(id)||!idOk(employeeId)||!Number.isSafeInteger(now)||now<0)throw Error('Invalid order identity');
 // Duplicate IDs must not be repriced against a changed catalog; return the immutable stored order.
 let exists=await db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();
 if(exists)throw Error('Order already exists; retrieve the original instead of replacing it');
 let catalog=await loadCatalog(db),snapshot=priceOrder(request,catalog);snapshot.catalogRevision=catalog.revision;
 let inserted=await db.prepare('INSERT INTO orders(id,employee_id,snapshot_json,subtotal_cents,tax_cents,total_cents,created_at) SELECT ?,?,?,?,?,?,? FROM catalog_revision WHERE singleton=1 AND revision=?').bind(id,employeeId,JSON.stringify(snapshot),snapshot.subtotalCents,snapshot.taxCents,snapshot.totalCents,now,catalog.revision).run();if(inserted.meta.changes<1)throw Error('Catalog changed, retry order');
 return snapshot;
}
export async function getOrder(db,id){if(!idOk(id))throw Error('Invalid order identity');let row=await db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();if(!row)return null;return {...row,snapshot:JSON.parse(row.snapshot_json)}}
