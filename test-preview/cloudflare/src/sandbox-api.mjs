// Restricted test API. No Square calls, no payment completion, no production support.
// Must remain behind the locked entry point until reviewed and specifically authorized.
import {login,authorize,logout} from './auth.mjs';
import {loadCatalog} from './catalog-d1.mjs';
import {createOrder,getOrder} from './orders-d1.mjs';
import {reserveAttempt,recordUncertain} from './attempts.mjs';
const idOK=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{8,64}$/.test(x);
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,'0')).join('');
async function audit(db,employee,event,entity,details={}){await db.prepare('INSERT INTO audit_events(id,employee_id,event,entity_id,created_at,details) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),employee,event,entity,Date.now(),JSON.stringify(details)).run()}
async function limit(db,bucket,max,now){let start=Math.floor(now/60000)*60000;let row=await db.prepare('INSERT INTO api_rate_limits(bucket,window_start,count) VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN window_start=excluded.window_start THEN count+1 ELSE 1 END,window_start=excluded.window_start RETURNING count').bind(bucket,start).first();return row.count<=max}
export async function sandboxApi(request,env){
 let url=new URL(request.url), origin=request.headers.get('origin');
 const local=env.APP_MODE==='local_test'&&url.hostname==='127.0.0.1';
 // Separate localhost-only integration harness; remote enabling is intentionally unsupported.
 if(!local||!env.DB||origin!==env.TEST_ORIGIN)return new Response('Disabled',{status:403,headers:{'cache-control':'no-store'}});
 const headers={'cache-control':'no-store','x-content-type-options':'nosniff','access-control-allow-origin':origin,'vary':'Origin','content-type':'application/json'};
 const reply=(status,obj)=>new Response(JSON.stringify(obj),{status,headers});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,authorization,x-csrf-token','access-control-max-age':'600'}});
 // Source is provided by Cloudflare in hosted environment; local harness uses a fixed source.
 if(!await limit(env.DB,'local-source',120,Date.now()))return reply(429,{error:'rate_limited'});
 if(!['GET','POST'].includes(request.method))return reply(405,{error:'method'});
 let body={};if(request.method==='POST'){
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return reply(415,{error:'content_type'});
  let text=await request.text();if(text.length>32768)return reply(413,{error:'too_large'});try{body=JSON.parse(text)}catch{return reply(400,{error:'invalid_json'})}
 }
 try{
  if(url.pathname==='/api/login'&&request.method==='POST'){
   if(!await limit(env.DB,'login-local-source',12,Date.now()))return reply(429,{error:'rate_limited'});
   let session=await login(env.DB,body.username,body.password);await audit(env.DB,null,session?'login_success':'login_failure',null);return session?reply(200,session):reply(401,{error:'invalid_credentials'});
  }
  let session=(request.headers.get('authorization')||'').replace(/^Bearer /,''),csrf=request.headers.get('x-csrf-token')||'';
  let admin=url.pathname==='/api/attempts/uncertain';let employee=await authorize(env.DB,session,csrf,admin?'admin':'cashier');if(!employee)return reply(401,{error:'unauthorized'});
  if(url.pathname==='/api/logout'&&request.method==='POST'){await logout(env.DB,session);await audit(env.DB,employee.id,'logout',null);return reply(200,{ok:true})}
  if(url.pathname==='/api/catalog'&&request.method==='GET')return reply(200,await loadCatalog(env.DB));
  if(url.pathname==='/api/orders'&&request.method==='POST'){
   try{let result=await createOrder(env.DB,{id:body.id,employeeId:employee.id,request:body.request,now:Date.now()});await audit(env.DB,employee.id,'order_created',body.id,{totalCents:result.totalCents});return reply(201,result)}catch{return reply(409,{error:'invalid_or_conflicting_order'})}
  }
  if(url.pathname==='/api/orders'&&request.method==='GET'){let id=url.searchParams.get('id');if(!idOK(id))return reply(400,{error:'invalid_id'});let order=await getOrder(env.DB,id);return order?reply(200,order):reply(404,{error:'not_found'})}
  if(url.pathname==='/api/attempts'&&request.method==='POST'){
   if(!idOK(body.id)||!idOK(body.orderId)||!idOK(body.idempotencyKey))return reply(400,{error:'invalid_attempt'});let order=await getOrder(env.DB,body.orderId);if(!order)return reply(404,{error:'not_found'});
   try{let a=await reserveAttempt(env.DB,{id:body.id,orderId:body.orderId,idempotencyKey:body.idempotencyKey,requestHash:await hash(order.snapshot_json),now:Date.now()});await audit(env.DB,employee.id,'attempt_reserved',a.id,{orderId:a.order_id});return reply(200,{id:a.id,orderId:a.order_id,status:a.status})}catch{return reply(409,{error:'attempt_conflict'})}
  }
  if(url.pathname==='/api/attempts'&&request.method==='GET'){let id=url.searchParams.get('id');if(!idOK(id))return reply(400,{error:'invalid_id'});let a=await env.DB.prepare('SELECT id,order_id,status,created_at,updated_at FROM payment_attempts WHERE id=?').bind(id).first();return a?reply(200,a):reply(404,{error:'not_found'})}
  if(url.pathname==='/api/attempts/uncertain'&&request.method==='POST'){if(!idOK(body.id))return reply(400,{error:'invalid_id'});let a=await recordUncertain(env.DB,body.id,Date.now());if(!a)return reply(404,{error:'not_found'});await audit(env.DB,employee.id,'attempt_uncertain',a.id,{status:a.status});return reply(200,{id:a.id,status:a.status})}
  return reply(404,{error:'not_found'});
 }catch{return reply(500,{error:'internal_error'})}
}
