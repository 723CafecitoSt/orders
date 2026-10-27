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
  let admin=['/api/attempts/uncertain','/api/stations'].includes(url.pathname);let employee=await authorize(env.DB,session,csrf,admin?'admin':'cashier');if(!employee)return reply(401,{error:'unauthorized'});
  if(url.pathname==='/api/logout'&&request.method==='POST'){await logout(env.DB,session);await audit(env.DB,employee.id,'logout',null);return reply(200,{ok:true})}
  if(url.pathname==='/api/stations'&&request.method==='POST'){
   if(!idOK(body.productId)||!['beverages','food'].includes(body.station))return reply(400,{error:'invalid_station'});
   await env.DB.prepare('INSERT INTO product_stations(product_id,station,updated_by,updated_at) VALUES(?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET station=excluded.station,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(body.productId,body.station,employee.id,Date.now()).run();return reply(200,{ok:true});
  }
  if(url.pathname==='/api/kitchen'&&request.method==='GET'){
   let station=url.searchParams.get('station');if(!['beverages','food'].includes(station))return reply(400,{error:'invalid_station'});
   if(employee.role!=='admin'&&!(await env.DB.prepare('SELECT 1 AS ok FROM kitchen_access WHERE employee_id=? AND station=?').bind(employee.id,station).first()))return reply(403,{error:'station_forbidden'});
   let before=url.searchParams.get('before'),limitText=url.searchParams.get('limit')||'100';if(!/^\d+$/.test(limitText)||Number(limitText)<1||Number(limitText)>100||(before!==null&&(!/^[1-9]\d{0,15}$/.test(before)||!Number.isSafeInteger(Number(before)))))return reply(400,{error:'invalid_page'});
   let limit=Number(limitText),rows=await env.DB.prepare('SELECT rowid AS cursor_id,order_id,line_index,station,snapshot_json,status,version,updated_at FROM kitchen_items WHERE station=? AND rowid<? ORDER BY rowid DESC LIMIT ?').bind(station,before===null?Number.MAX_SAFE_INTEGER:Number(before),limit+1).all();let hasMore=rows.results.length>limit,visible=rows.results.slice(0,limit);
   return reply(200,{items:visible.map(r=>{let item=JSON.parse(r.snapshot_json);return {orderId:r.order_id,lineIndex:r.line_index,station:r.station,name:item.name,quantity:item.quantity,modifiers:item.modifiers.map(m=>m.name),note:item.note||'',status:r.status,version:r.version}}),nextCursor:hasMore?String(visible.at(-1).cursor_id):null});
  }
  if(url.pathname==='/api/kitchen/status'&&request.method==='POST'){
   if(!idOK(body.orderId)||!Number.isSafeInteger(body.lineIndex)||body.lineIndex<0||!Number.isSafeInteger(body.version)||body.version<0||!['preparing','ready'].includes(body.status))return reply(400,{error:'invalid_state'});
   let target=await env.DB.prepare('SELECT station FROM kitchen_items WHERE order_id=? AND line_index=?').bind(body.orderId,body.lineIndex).first();if(!target)return reply(404,{error:'not_found'});if(employee.role!=='admin'&&!(await env.DB.prepare('SELECT 1 AS ok FROM kitchen_access WHERE employee_id=? AND station=?').bind(employee.id,target.station).first()))return reply(403,{error:'station_forbidden'});
   let r=await env.DB.prepare("UPDATE kitchen_items SET status=?,version=version+1,updated_by=?,updated_at=? WHERE order_id=? AND line_index=? AND version=? AND (status='new' OR (status='preparing' AND ?='ready')) RETURNING status,version").bind(body.status,employee.id,Date.now(),body.orderId,body.lineIndex,body.version,body.status).first();return r?reply(200,r):reply(409,{error:'stale_or_invalid_state'});
  }
  if(url.pathname==='/api/catalog'&&request.method==='GET')return reply(200,await loadCatalog(env.DB));
  if(url.pathname==='/api/orders'&&request.method==='POST'){
   try{let result=await createOrder(env.DB,{id:body.id,employeeId:employee.id,request:body.request,expectedTotalCents:body.expectedTotalCents,now:Date.now()});return reply(201,result)}catch{return reply(409,{error:'invalid_or_conflicting_order'})}
  }
  if(url.pathname==='/api/orders'&&request.method==='GET'){let id=url.searchParams.get('id');if(!idOK(id))return reply(400,{error:'invalid_id'});let order=await getOrder(env.DB,id);return order?reply(200,order):reply(404,{error:'not_found'})}
  if(url.pathname==='/api/attempts'&&request.method==='POST'){
   if(!idOK(body.id)||!idOK(body.orderId)||!idOK(body.idempotencyKey))return reply(400,{error:'invalid_attempt'});let order=await getOrder(env.DB,body.orderId);if(!order)return reply(404,{error:'not_found'});
   try{let a=await reserveAttempt(env.DB,{id:body.id,orderId:body.orderId,idempotencyKey:body.idempotencyKey,requestHash:await hash(order.snapshot_json),now:Date.now()});return reply(200,{id:a.id,orderId:a.order_id,status:a.status})}catch{return reply(409,{error:'attempt_conflict'})}
  }
  if(url.pathname==='/api/attempts'&&request.method==='GET'){let id=url.searchParams.get('id');if(!idOK(id))return reply(400,{error:'invalid_id'});let a=await env.DB.prepare('SELECT id,order_id,status,created_at,updated_at FROM payment_attempts WHERE id=?').bind(id).first();return a?reply(200,a):reply(404,{error:'not_found'})}
  if(url.pathname==='/api/attempts/uncertain'&&request.method==='POST'){if(!idOK(body.id))return reply(400,{error:'invalid_id'});let a=await recordUncertain(env.DB,body.id,Date.now());if(!a)return reply(404,{error:'not_found'});await audit(env.DB,employee.id,'attempt_uncertain',a.id,{status:a.status});return reply(200,{id:a.id,status:a.status})}
  return reply(404,{error:'not_found'});
 }catch{return reply(500,{error:'internal_error'})}
}
