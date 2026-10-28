import {assignPager,deliverOrder,kitchenOrders,orderHistory} from './fulfillment-d1.mjs';
// Integrated test API. Remote mode requires explicit, isolated configuration; production is unsupported.
// No Square client or payment execution is available. Deployment still requires authorization.
import {login,authorize,logout,createStaff,revokeStaff} from './auth.mjs';
import {applyCatalog} from './catalog-admin.mjs';
import {privateRequestAllowed,sourceKey,rateAllowed,readJson,tokenEqual} from './security.mjs';
import {loadCatalog} from './catalog-d1.mjs';
import {createOrder,getOrder} from './orders-d1.mjs';
import {reserveAttempt,recordUncertain} from './attempts.mjs';
const idOK=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{8,64}$/.test(x);
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,'0')).join('');
async function audit(db,employee,event,entity,details={}){await db.prepare('INSERT INTO audit_events(id,employee_id,event,entity_id,created_at,details) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),employee,event,entity,Date.now(),JSON.stringify(details)).run()}
export async function sandboxApi(request,env){
 let url=new URL(request.url), origin=request.headers.get('origin');
 const local=env.APP_MODE==='local_test'&&url.hostname==='127.0.0.1';
 const remote=privateRequestAllowed(request,env);
 if((!local&&!remote)||!env.DB||origin!==(remote?env.TEST_FRONTEND_ORIGIN:env.TEST_ORIGIN))return new Response('Disabled',{status:403,headers:{'cache-control':'no-store'}});
 const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','access-control-allow-origin':origin,'vary':'Origin','content-type':'application/json'};
 const reply=(status,obj)=>new Response(JSON.stringify(obj),{status,headers:{...headers,...(status===429?{'retry-after':'60'}:{})}});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,authorization,x-csrf-token,x-bootstrap-token','access-control-max-age':'600'}});
 let body={},source;
 try{source=remote?await sourceKey(request,env.RATE_LIMIT_SECRET):'local-source';if(!await rateAllowed(env.DB,'source:'+source,120))return reply(429,{error:'rate_limited'});
 if(!['GET','POST'].includes(request.method))return reply(405,{error:'method'});
 if(remote&&url.pathname.startsWith('/api/attempts'))return reply(404,{error:'payments_disabled'});
 if(request.method==='POST'){if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return reply(415,{error:'content_type'});body=await readJson(request)}
 }catch(e){return reply(e.status||503,{error:e.status?e.message:'temporarily_unavailable'})}
 try{
  if(url.pathname==='/api/bootstrap'&&request.method==='POST'){
   if(!remote||!await rateAllowed(env.DB,'bootstrap:'+source,3)||!await tokenEqual(request.headers.get('x-bootstrap-token'),env.BOOTSTRAP_SECRET))return reply(403,{error:'forbidden'});
   let count=await env.DB.prepare('SELECT COUNT(*) n FROM employees').first();if(count.n!==0)return reply(409,{error:'already_initialized'});
   try{await createStaff(env.DB,{id:crypto.randomUUID().replaceAll('-',''),username:body.username,password:body.password,role:'administrator',bootstrap:true});return reply(201,{ok:true})}catch(e){if(e.code==='password_hash_unavailable')return reply(503,{error:'password_hash_unavailable'});if(e.code==='invalid_staff')return reply(400,{error:'invalid_staff'});return reply(409,{error:'bootstrap_storage_conflict'})}
  }
  if(url.pathname==='/api/login'&&request.method==='POST'){
   if(!await rateAllowed(env.DB,'login:'+source,remote?5:12))return reply(429,{error:'rate_limited'});
   let session=await login(env.DB,body.username,body.password);if(!session)await audit(env.DB,null,'login_failure',null);return session?reply(200,session):reply(401,{error:'invalid_credentials'});
  }
  let session=(request.headers.get('authorization')||'').replace(/^Bearer /,''),csrf=request.headers.get('x-csrf-token')||'';
  let employee=await authorize(env.DB,session,csrf,'authenticated');if(!employee)return reply(401,{error:'unauthorized'});
  if(!await rateAllowed(env.DB,'employee:'+employee.id,180))return reply(429,{error:'rate_limited'});
  const deny=async(status,reason)=>{await audit(env.DB,employee.id,'access_denied',null,{path:url.pathname,reason});return reply(status,{error:reason})};
  const admin=employee.permissions.includes('administrator'),cashier=admin||employee.permissions.includes('cashier');
  if(['/api/stations','/api/catalog/apply','/api/employees','/api/employees/revoke','/api/attempts/uncertain'].includes(url.pathname)&&!admin)return deny(403,'administrator_required');
  if(['/api/catalog','/api/orders','/api/orders/list','/api/orders/pager','/api/orders/delivered','/api/attempts'].includes(url.pathname)&&!cashier)return deny(403,'cashier_required');
  if(url.pathname==='/api/session'&&request.method==='GET')return reply(200,{id:employee.id,permissions:employee.permissions});
  if(url.pathname==='/api/employees'&&request.method==='GET'){let staff=await env.DB.prepare('SELECT id,username,enabled FROM employees ORDER BY username').all();return reply(200,{employees:staff.results})}
  if(url.pathname==='/api/employees'&&request.method==='POST'){try{let created=await createStaff(env.DB,{id:crypto.randomUUID().replaceAll('-',''),username:body.username,password:body.password,role:body.role,actorId:employee.id});return reply(201,created)}catch{return reply(400,{error:'invalid_employee'})}}
  if(url.pathname==='/api/employees/revoke'&&request.method==='POST'){try{await revokeStaff(env.DB,{id:body.id,actorId:employee.id,disable:body.disable===true});return reply(200,{ok:true})}catch{return reply(400,{error:'invalid_employee'})}}
  if(url.pathname==='/api/catalog/apply'&&request.method==='POST'){try{return reply(200,await applyCatalog(env.DB,body,employee.id))}catch{return reply(409,{error:'invalid_or_stale_catalog'})}}
  if(url.pathname==='/api/logout'&&request.method==='POST'){await logout(env.DB,session);return reply(200,{ok:true})}
  if(url.pathname==='/api/stations'&&request.method==='POST'){
   if(!idOK(body.productId)||!['beverages','food'].includes(body.station))return reply(400,{error:'invalid_station'});
   await env.DB.prepare('INSERT INTO product_stations(product_id,station,updated_by,updated_at) VALUES(?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET station=excluded.station,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(body.productId,body.station,employee.id,Date.now()).run();return reply(200,{ok:true});
  }
  if(['/api/orders/pager','/api/orders/delivered'].includes(url.pathname)&&request.method==='POST'){
   if(!idOK(body.orderId)||!Number.isSafeInteger(body.version)||body.version<0||(url.pathname.endsWith('/pager')&&!Object.hasOwn(body,'pagerNumber')))return reply(400,{error:'invalid_order_update'});
   try{return reply(200,await (url.pathname.endsWith('/pager')?assignPager(env.DB,{orderId:body.orderId,pagerNumber:body.pagerNumber,version:body.version,actorId:employee.id}):deliverOrder(env.DB,{orderId:body.orderId,version:body.version,actorId:employee.id})))}catch(e){return reply(e.status||400,{error:e.code||'invalid_order_update',...(e.code==='pager_in_use'?{pagerNumber:e.pagerNumber,conflictingOrderNumber:e.conflictingOrderNumber,conflictingOrderBusinessDate:e.conflictingOrderBusinessDate}:{})})}
  }
  if(['/api/kitchen/orders','/api/orders/list'].includes(url.pathname)&&request.method==='GET'){
   let before=url.searchParams.get('before'),count=url.searchParams.get('limit')||'20';if(!/^[1-9]\d?$/.test(count)||Number(count)>50||(before!==null&&(!/^[1-9]\d{0,15}$/.test(before)||!Number.isSafeInteger(Number(before)))))return reply(400,{error:'invalid_page'});
   const page={before:before===null?Number.MAX_SAFE_INTEGER:Number(before),limit:Number(count)};
   if(url.pathname==='/api/orders/list')return reply(200,await orderHistory(env.DB,page));
   let station=url.searchParams.get('station')||'all';if(!['all','beverages','food'].includes(station))return reply(400,{error:'invalid_station'});let allowed=admin||cashier?['beverages','food']:employee.permissions.filter(p=>['beverages','food'].includes(p));if((station==='all'&&allowed.length!==2)||(station!=='all'&&!allowed.includes(station)))return deny(403,'station_forbidden');
   return reply(200,await kitchenOrders(env.DB,{...page,station,allowedStations:allowed,includeDelivered:url.searchParams.get('includeDelivered')==='1'}));
  }
  if(url.pathname==='/api/kitchen'&&request.method==='GET'){
   let station=url.searchParams.get('station');if(!['beverages','food'].includes(station))return reply(400,{error:'invalid_station'});
   if(!admin&&!employee.permissions.includes(station))return deny(403,'station_forbidden');
   let before=url.searchParams.get('before'),limitText=url.searchParams.get('limit')||'100';if(!/^\d+$/.test(limitText)||Number(limitText)<1||Number(limitText)>100||(before!==null&&(!/^[1-9]\d{0,15}$/.test(before)||!Number.isSafeInteger(Number(before)))))return reply(400,{error:'invalid_page'});
   let limit=Number(limitText),rows=await env.DB.prepare("SELECT k.rowid AS cursor_id,k.order_id,k.line_index,k.station,k.snapshot_json,k.status,k.version,k.updated_at,COALESCE(d.daily_number,n.number) AS number,d.business_date,json_extract(o.snapshot_json,'$.orderNote') AS order_note FROM kitchen_items k JOIN order_numbers n ON n.order_id=k.order_id JOIN orders o ON o.id=k.order_id LEFT JOIN business_order_numbers d ON d.order_id=o.id WHERE k.station=? AND k.rowid<? ORDER BY k.rowid DESC LIMIT ?").bind(station,before===null?Number.MAX_SAFE_INTEGER:Number(before),limit+1).all();let hasMore=rows.results.length>limit,visible=rows.results.slice(0,limit);
   return reply(200,{items:visible.map(r=>{let item=JSON.parse(r.snapshot_json);return {orderId:r.order_id,number:r.number,businessDate:r.business_date,orderNote:r.order_note||'',lineIndex:r.line_index,station:r.station,name:item.name,quantity:item.quantity,modifiers:item.modifiers.map(m=>m.name),note:item.note||'',status:r.status,version:r.version}}),nextCursor:hasMore?String(visible.at(-1).cursor_id):null});
  }
  if(url.pathname==='/api/kitchen/status'&&request.method==='POST'){
   if(!idOK(body.orderId)||!Number.isSafeInteger(body.lineIndex)||body.lineIndex<0||!Number.isSafeInteger(body.version)||body.version<0||!['preparing','ready'].includes(body.status))return reply(400,{error:'invalid_state'});
   let target=await env.DB.prepare('SELECT station FROM kitchen_items WHERE order_id=? AND line_index=?').bind(body.orderId,body.lineIndex).first();if(!target)return reply(404,{error:'not_found'});if(!admin&&!employee.permissions.includes(target.station))return deny(403,'station_forbidden');
   let r=await env.DB.prepare("UPDATE kitchen_items SET status=?,version=version+1,updated_by=?,updated_at=? WHERE order_id=? AND line_index=? AND version=? AND (status='new' OR (status='preparing' AND ?='ready')) RETURNING status,version").bind(body.status,employee.id,Date.now(),body.orderId,body.lineIndex,body.version,body.status).first();return r?reply(200,r):reply(409,{error:'stale_or_invalid_state'});
  }
  if(url.pathname==='/api/catalog'&&request.method==='GET')return reply(200,await loadCatalog(env.DB));
  if(url.pathname==='/api/orders'&&request.method==='POST'){
   try{let result=await createOrder(env.DB,{id:body.id,employeeId:employee.id,request:body.request,expectedTotalCents:body.expectedTotalCents,now:Date.now()});return reply(201,result)}catch(e){return reply(409,{error:e.code||'invalid_or_conflicting_order',...(e.code==='pager_in_use'?{pagerNumber:e.pagerNumber,conflictingOrderNumber:e.conflictingOrderNumber,conflictingOrderBusinessDate:e.conflictingOrderBusinessDate}:{})})}
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
