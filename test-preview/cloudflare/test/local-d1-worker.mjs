import privateWorker from '../src/worker.mjs';
import {uiFixture,bulkKitchenFixture} from './ui-fixture.mjs';
import {sandboxApi} from '../src/sandbox-api.mjs';
// Local integration harness only. No payment calls or secrets.
import {localApi} from '../src/local-api.mjs';
import {createStaff,login,authorize,logout} from '../src/auth.mjs';
import {createOrder,getOrder} from '../src/orders-d1.mjs';
import {reserveAttempt,recordUncertain} from '../src/attempts.mjs';
function check(v,msg){if(!v)throw Error(msg)}
export default {async fetch(req,env){if(env.APP_MODE!=='local_test'||new URL(req.url).hostname!=='127.0.0.1')return new Response('disabled',{status:503});if(new URL(req.url).pathname==='/daily-number-fixture')return dailyNumberTest(env);if(new URL(req.url).pathname==='/password-compat-fixture')return passwordCompatibility(req,env);if(new URL(req.url).pathname.startsWith('/private-api/')){let u=new URL(req.url);u.pathname=u.pathname.replace('/private-api','');return privateWorker.fetch(new Request(u,req),{...env,APP_MODE:'private_test',TEST_ENABLED:'true',PAYMENTS_ENABLED:'false',TEST_DATABASE_ID:'local-security-suite',TEST_FRONTEND_ORIGIN:'https://test.localhost',TEST_API_ORIGIN:u.origin,RATE_LIMIT_SECRET:'LOCAL_SECURITY_SUITE_NOT_A_SECRET_12345',CASH_RECORDING_ENABLED:req.headers.get('x-local-cash-enabled')==='1'?'true':'false'});}if(new URL(req.url).pathname==='/bulk-fixture')return Response.json(await bulkKitchenFixture(env.DB));if(new URL(req.url).pathname==='/ui-fixture')return Response.json(await uiFixture(env.DB));if(new URL(req.url).pathname.startsWith('/api/'))return sandboxApi(req,{...env,TEST_ORIGIN:'https://test.localhost'});if(new URL(req.url).pathname!=='/')return localApi(req,env);try{
 let db=env.DB,id='local_'+crypto.randomUUID().replaceAll('-',''),orderId='order_'+id,emp='staff_'+id,product='product_'+id;
 await createStaff(db,{id:emp,username:id,password:'test-password-123',role:'cashier'});let bad=await login(db,id,'incorrect');check(bad===null,'bad password');let l=await login(db,id,'test-password-123');check(l?.session,'login');check((await authorize(db,l.session,l.csrf,'cashier'))?.id===emp,'cashier');check(await authorize(db,l.session,l.csrf,'admin')===null,'permissions');check(await authorize(db,l.session,'0'.repeat(64))===null,'csrf');
 await db.prepare('INSERT INTO products (id,name,base_cents,iced_cents,tax_bps,active) VALUES (?,?,?,?,?,1)').bind(product,'Test Latte',700,700,825).run();
 await db.prepare('INSERT INTO product_stations(product_id,station,updated_by,updated_at) VALUES(?,?,?,?)').bind(product,'beverages',emp,Date.now()).run();
 let waffle='waffle_'+id;await db.prepare('INSERT INTO products(id,name,base_cents,tax_bps,active) VALUES(?,?,800,725,1)').bind(waffle,'Waffle').run();await db.prepare('INSERT INTO product_stations(product_id,station,updated_by,updated_at) VALUES(?,?,?,?)').bind(waffle,'food',emp,Date.now()).run();
 let group='flavor_'+id,modifier='caramel_'+id;await db.prepare('INSERT INTO modifier_groups(id,name,min_selected,max_selected,included_count,active) VALUES(?,?,0,3,0,1)').bind(group,'Flavor').run();await db.prepare('INSERT INTO modifiers(id,group_id,name,price_cents,taxable,active) VALUES(?,?,?,100,1,1)').bind(modifier,group,'Caramel').run();await db.prepare('INSERT INTO product_groups(product_id,group_id) VALUES(?,?)').bind(product,group).run();
 await db.prepare('INSERT INTO kitchen_access(employee_id,station) VALUES(?,?),(?,?)').bind(emp,'beverages',emp,'food').run();
 let args={id:orderId,employeeId:emp,request:{items:[{productId:product,quantity:2,baseCents:1,modifierIds:[]}]},now:Date.now()};let order=await createOrder(db,args);check(order.totalCents===1516,'server pricing');check((await getOrder(db,orderId)).snapshot.totalCents===1516,'persisted order');
 let a={id:'attempt_'+id,orderId,idempotencyKey:'idem_'+id,requestHash:'a'.repeat(64),now:Date.now()};let results=await Promise.all([reserveAttempt(db,a),reserveAttempt(db,a)]);check(results.every(x=>x.id===a.id),'same retry');let conflict=false;try{await reserveAttempt(db,{...a,id:'other_'+id,idempotencyKey:'different_'+id})}catch{conflict=true}check(conflict,'duplicate lock');let order2='otherorder_'+id;await createOrder(db,{...args,id:order2});let pair=await Promise.allSettled([reserveAttempt(db,{...a,orderId:order2,id:'first_'+id,idempotencyKey:'firstkey_'+id}),reserveAttempt(db,{...a,orderId:order2,id:'second_'+id,idempotencyKey:'secondkey_'+id})]);check(pair.filter(x=>x.status==='fulfilled').length===1,'competing operations');check((await recordUncertain(db,a.id,Date.now())).status==='uncertain','uncertain');await logout(db,l.session);check(await authorize(db,l.session,l.csrf)===null,'logout');return Response.json({ok:true,username:id,productId:product,waffleId:waffle,modifierId:modifier,checks:['login','roles','csrf','server-pricing','persistence','concurrency','duplicate','uncertain','logout']});
 }catch(e){return Response.json({ok:false,error:e.message},{status:500})}}};

// Only reachable through this localhost-only integration harness; never part of the deployed Worker.
async function passwordCompatibility(req,env){
 const api=new URL(req.url).origin,origin='https://test.localhost',username='kdf_'+crypto.randomUUID().slice(0,8),password='LOCAL_TEST_ONLY_password_123',secret='LOCAL_ONLY_BOOTSTRAP_COMPATIBILITY_FIXTURE_12345678901234567890';
 const config={...env,APP_MODE:'private_test',TEST_ENABLED:'true',PAYMENTS_ENABLED:'false',TEST_DATABASE_ID:'local-kdf-suite',TEST_FRONTEND_ORIGIN:origin,TEST_API_ORIGIN:api,RATE_LIMIT_SECRET:'LOCAL_ONLY_KDF_RATE_SECRET_1234567890123456',BOOTSTRAP_SECRET:secret};
 async function call(path,body){const response=await privateWorker.fetch(new Request(api+path,{method:'POST',headers:{origin,'content-type':'application/json','cf-connecting-ip':'127.0.0.91','x-bootstrap-token':secret},body:JSON.stringify(body)}),config);return {status:response.status,body:await response.json()}}
 const original=crypto.subtle.deriveBits,start=performance.now();
 try{
  crypto.subtle.deriveBits=async()=>{throw new DOMException('Simulated production iteration ceiling','NotSupportedError')};
  check((await call('/api/bootstrap',{username,password})).status===201,'fallback bootstrap');
  const fallbackLogin=await call('/api/login',{username,password});check(fallbackLogin.status===200&&fallbackLogin.body.permissions.includes('administrator'),'fallback login');
  check((await call('/api/login',{username,password:'incorrect-password'})).status===401,'fallback rejects incorrect password');
  const durationMs=Math.round(performance.now()-start);crypto.subtle.deriveBits=original;
  check((await call('/api/login',{username,password})).status===200,'native verifies fallback-created hash');
  check((await call('/api/bootstrap',{username:'secondadmin',password})).status===409,'one-time bootstrap remains enforced');
  const counts=await env.DB.prepare('SELECT (SELECT COUNT(*) FROM employees WHERE username=?) employees,(SELECT COUNT(*) FROM bootstrap_once) initializations').bind(username).first();check(counts.employees===1&&counts.initializations===1,'persistent one-time initialization');
  return Response.json({ok:true,durationMs,checks:['native-cap-simulated','bootstrap-endpoint','login-endpoint','wrong-password-rejected','native-hash-compatible','one-time-bootstrap','persistent-d1']});
 }catch{return Response.json({ok:false,error:'password_compatibility_test_failed'},{status:500})}finally{crypto.subtle.deriveBits=original}
}

async function dailyNumberTest(env){try{
 const suffix=crypto.randomUUID().replaceAll('-',''),employee='daily_'+suffix,product='daily_product_'+suffix;
 await createStaff(env.DB,{id:employee,username:'daily_'+suffix,password:'LOCAL_ONLY_test_password_123',role:'administrator'});
 await env.DB.prepare('INSERT INTO products(id,name,base_cents,tax_bps,active) VALUES(?,?,700,825,1)').bind(product,'Daily test').run();
 await env.DB.prepare('INSERT INTO product_stations VALUES(?,?,?,?)').bind(product,'beverages',employee,Date.now()).run();
 const request={items:[{productId:product,quantity:1,modifierIds:[]}]},args={employeeId:employee,request,now:Date.parse('2012-07-15T05:59:59Z')};
 let first=await createOrder(env.DB,{...args,id:'daily_first_'+suffix});check(first.number===1&&first.businessDate==='2012-07-14','day before local midnight');
 let newArgs={...args,now:Date.parse('2012-07-15T06:00:00Z')};let pair=await Promise.all([createOrder(env.DB,{...newArgs,id:'daily_second_'+suffix}),createOrder(env.DB,{...newArgs,id:'daily_third_'+suffix})]);check(JSON.stringify(pair.map(o=>o.number).sort())==='[1,2]'&&pair.every(o=>o.businessDate==='2012-07-15'),'atomic next-day numbering');
 let replay=await createOrder(env.DB,{...newArgs,id:first.orderId});check(replay.number===1&&replay.businessDate===first.businessDate,'next-day replay keeps original number and date');
 const stored=await getOrder(env.DB,pair[0].orderId);check(stored.snapshot.totalCents===758,'snapshot amount remains correct');
 return Response.json({ok:true,checks:['daily-midnight','atomic-concurrency','cross-midnight-replay','immutable-total']});
 }catch{return Response.json({ok:false,error:'daily_number_test_failed'},{status:500})}}
