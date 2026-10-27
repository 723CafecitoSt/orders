// Storage primitives only. No provider calls and no payment state can be marked paid here.
// Caller must authenticate, authorize and create an immutable order first.
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{8,64}$/.test(x);
export async function reserveAttempt(db,{id,orderId,idempotencyKey,requestHash,now}){
 if(![id,orderId,idempotencyKey].every(validId)||!/^[a-f0-9]{64}$/.test(requestHash)||!Number.isSafeInteger(now)||now<0)throw Error('Invalid attempt');
 await db.prepare("INSERT OR IGNORE INTO payment_attempts (id,order_id,idempotency_key,request_hash,status,created_at,updated_at) VALUES(?,?,?,?,'pending',?,?)").bind(id,orderId,idempotencyKey,requestHash,now,now).run();
 const row=await db.prepare('SELECT * FROM payment_attempts WHERE order_id=? OR id=? OR idempotency_key=?').bind(orderId,id,idempotencyKey).all();
 if(row.results.length!==1)throw Error('Conflicting attempts');let a=row.results[0];
 if(a.id!==id||a.order_id!==orderId||a.idempotency_key!==idempotencyKey||a.request_hash!==requestHash)throw Error('Order or idempotency key reused');
 return a;
}
export async function recordUncertain(db,id,now){
 if(!validId(id)||!Number.isSafeInteger(now))throw Error('Invalid attempt');
 await db.prepare("UPDATE payment_attempts SET status='uncertain',updated_at=? WHERE id=? AND status='pending'").bind(now,id).run();
 return db.prepare('SELECT * FROM payment_attempts WHERE id=?').bind(id).first();
}
