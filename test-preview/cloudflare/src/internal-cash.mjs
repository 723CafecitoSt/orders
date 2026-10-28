// Internal cash ledger only. No Square imports, credentials, URLs or fetch calls.
import {getOrder} from './orders-d1.mjs';
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{8,64}$/.test(id);
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('');
const fail=(code,status=409)=>Object.assign(Error(code),{code,status});
export function cashRecordingEnabled(env){return env.APP_MODE==='private_test'&&env.TEST_ENABLED==='true'&&env.PAYMENTS_ENABLED==='false'&&env.CASH_RECORDING_ENABLED==='true'}
export function publicCashReceipt(row){return row?{id:row.id,orderId:row.order_id,employeeId:row.employee_id,number:row.order_number,businessDate:row.business_date,status:'recorded',method:'cash',environment:'test',sentToSquare:false,currency:row.currency,amountCents:row.amount_cents,subtotalCents:row.subtotal_cents,taxCents:row.tax_cents,receivedCents:row.received_cents,changeCents:row.change_cents,createdAt:row.created_at}:null}
export async function cashReceipt(db,orderId){if(!validId(orderId))throw fail('invalid_order_id',400);return publicCashReceipt(await db.prepare('SELECT * FROM internal_cash_receipts WHERE order_id=?').bind(orderId).first())}
export async function recordInternalCash(db,{orderId,receivedCents,employeeId,now=Date.now()}){
 if(!validId(orderId)||!validId(employeeId)||!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(receivedCents)||receivedCents<0||receivedCents>100000000)throw fail('invalid_cash_request',400);
 const order=await getOrder(db,orderId);if(!order)throw fail('order_not_found',404);const snapshot=order.snapshot;
 if(snapshot.totalCents<0||receivedCents<snapshot.totalCents)throw fail('insufficient_cash',400);
 const fingerprint=await hash(order.snapshot_json),requestHash=await hash(JSON.stringify({orderId,snapshotHash:fingerprint,receivedCents,method:'internal_cash',environment:'test'})),id='cash_'+(await hash(orderId)).slice(0,32);
 await db.batch([
 db.prepare("INSERT INTO payment_attempts(id,order_id,idempotency_key,request_hash,status,created_at,updated_at) VALUES(?,?,?,?,'internal_cash_recorded_test',?,?) ON CONFLICT DO NOTHING").bind(id,orderId,id,requestHash,now,now),
 db.prepare("INSERT INTO internal_cash_receipts(id,order_id,employee_id,order_number,business_date,amount_cents,subtotal_cents,tax_cents,received_cents,change_cents,snapshot_hash,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM payment_attempts WHERE id=? AND order_id=? AND request_hash=? AND status='internal_cash_recorded_test') ON CONFLICT DO NOTHING").bind(id,orderId,employeeId,snapshot.number,snapshot.businessDate,snapshot.totalCents,snapshot.subtotalCents,snapshot.taxCents,receivedCents,receivedCents-snapshot.totalCents,fingerprint,now,id,orderId,requestHash)
 ]);
 const saved=await db.prepare('SELECT * FROM internal_cash_receipts WHERE order_id=?').bind(orderId).first();if(!saved)throw fail('another_payment_operation_exists');
 if(saved.id!==id||saved.received_cents!==receivedCents||saved.snapshot_hash!==fingerprint||saved.amount_cents!==snapshot.totalCents)throw fail('cash_already_recorded_with_different_values');
 return publicCashReceipt(saved);
}
export async function cashHistory(db,{before=Number.MAX_SAFE_INTEGER,limit=20,date=null}={}){if(!Number.isSafeInteger(before)||before<1||!Number.isSafeInteger(limit)||limit<1||limit>100||date!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw fail('invalid_page',400);
 const query='SELECT * FROM internal_cash_receipts WHERE sequence<?'+(date?' AND business_date=?':'')+' ORDER BY sequence DESC LIMIT ?',rows=await db.prepare(query).bind(before,...(date?[date]:[]),limit+1).all(),visible=rows.results.slice(0,limit);return {receipts:visible.map(publicCashReceipt),nextCursor:rows.results.length>limit?String(visible.at(-1).sequence):null}}
export async function cashSummary(db,date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw fail('invalid_date',400);const row=await db.prepare('SELECT COUNT(*) AS orders,COALESCE(SUM(amount_cents),0) AS totalCents,COALESCE(SUM(subtotal_cents),0) AS subtotalCents,COALESCE(SUM(tax_cents),0) AS taxCents,COALESCE(SUM(received_cents),0) AS receivedCents,COALESCE(SUM(change_cents),0) AS changeCents FROM internal_cash_receipts WHERE business_date=?').bind(date).first();return {...row,businessDate:date,currency:'USD',environment:'test',sentToSquare:false}}
