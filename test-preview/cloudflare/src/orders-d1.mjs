// D1 order storage. Caller authenticates, authorizes, validates origin and bounds request size.
import {loadCatalog} from './catalog-d1.mjs';
import {priceOrder} from './pricing.mjs';
const idOk=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{8,64}$/.test(x);
function canonical(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}'}
async function fingerprint(request){let bytes=new TextEncoder().encode(canonical(request));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('')}
function existingSnapshot(row,employeeId,hash){if(row.employee_id!==employeeId||!row.request_fingerprint||row.request_fingerprint!==hash)throw Error('Order identity conflict');return JSON.parse(row.snapshot_json)}
export async function createOrder(db,{id,employeeId,request,now,expectedTotalCents}){
 if(!idOk(id)||!idOk(employeeId)||!Number.isSafeInteger(now)||now<0||!request||typeof request!=='object')throw Error('Invalid order identity');
 let hash=await fingerprint(request),exists=await db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();if(exists)return existingSnapshot(exists,employeeId,hash);
 let catalog=await loadCatalog(db),snapshot=priceOrder(request,catalog);snapshot.catalogRevision=catalog.revision;if(expectedTotalCents!==undefined&&(!Number.isSafeInteger(expectedTotalCents)||expectedTotalCents!==snapshot.totalCents))throw Error('Server total differs');
 await db.prepare('INSERT OR IGNORE INTO orders(id,employee_id,snapshot_json,subtotal_cents,tax_cents,total_cents,created_at,request_fingerprint) SELECT ?,?,?,?,?,?,?,? FROM catalog_revision WHERE singleton=1 AND revision=?').bind(id,employeeId,JSON.stringify(snapshot),snapshot.subtotalCents,snapshot.taxCents,snapshot.totalCents,now,hash,catalog.revision).run();
 // Read the stored immutable snapshot after insert, including a concurrent winner.
 let stored=await db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();if(!stored)throw Error('Catalog changed, retry order');return existingSnapshot(stored,employeeId,hash);
}
export async function getOrder(db,id){if(!idOk(id))throw Error('Invalid order identity');let row=await db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();if(!row)return null;return {...row,snapshot:JSON.parse(row.snapshot_json)}}
