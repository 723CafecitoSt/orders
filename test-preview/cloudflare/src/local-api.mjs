// LOCAL TESTS ONLY. No real payments or provider connections. Not for deployment.
import {login,authorize,logout} from './auth.mjs';import {createOrder,getOrder} from './orders-d1.mjs';import {reserveAttempt} from './attempts.mjs';
const ORIGIN='http://127.0.0.1:8797';
const response=(s,b)=>Response.json(b,{status:s,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const idOk=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{8,64}$/.test(x);
export async function localApi(request,env){
 let url=new URL(request.url);if(env.APP_MODE!=='local_test'||url.origin!==ORIGIN||!env.DB)return response(503,{error:'disabled'});
 if(request.headers.get('origin')!==ORIGIN)return response(403,{error:'origin'});
 if(request.method!=='POST'||request.headers.get('content-type')!=='application/json')return response(405,{error:'method'});
 let body;try{let text=await request.text();if(text.length>32768)return response(413,{error:'too_large'});body=JSON.parse(text)}catch{return response(400,{error:'invalid_json'})}
 if(url.pathname==='/login'){const x=await login(env.DB,body.username,body.password);return x?response(200,x):response(401,{error:'invalid_credentials'})}
 let session=(request.headers.get('authorization')||'').replace(/^Bearer /,''),csrf=request.headers.get('x-csrf-token')||'';let employee=await authorize(env.DB,session,csrf);if(!employee)return response(401,{error:'unauthorized'});
 if(url.pathname==='/logout'){await logout(env.DB,session);return response(200,{ok:true})}
 if(url.pathname==='/orders'){try{let order=await createOrder(env.DB,{id:body.id,employeeId:employee.id,request:body.request,now:Date.now()});return response(201,order)}catch{return response(409,{error:'invalid_or_conflicting_order'})}}
 if(url.pathname==='/attempts'){if(!idOk(body.orderId)||!idOk(body.id)||!idOk(body.idempotencyKey))return response(400,{error:'invalid_attempt'});let order=await getOrder(env.DB,body.orderId);if(!order)return response(404,{error:'order_not_found'});let bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(order.snapshot_json));let digest=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');try{let attempt=await reserveAttempt(env.DB,{id:body.id,orderId:body.orderId,idempotencyKey:body.idempotencyKey,requestHash:digest,now:Date.now()});return response(200,{id:attempt.id,status:attempt.status})}catch{return response(409,{error:'attempt_conflict'})}}
 return response(404,{error:'not_found'});
}
