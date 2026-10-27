// Experimental browser adapter; never enabled by default and not wired into the POS UI.
// Session credentials stay in memory only; this alone does not protect against XSS.
export function createTestClient({enabled=false,baseUrl,fetchImpl=fetch}={}) {
 let session=null;
 if(enabled){let u=new URL(baseUrl);if(u.protocol!=='https:'||u.hostname!=='127.0.0.1')throw Error('Only local HTTPS testing is supported');baseUrl=u.origin}
 async function request(path,method='GET',data){if(!enabled)throw Error('Test API disabled');let r=await fetchImpl(baseUrl+path,{method,cache:'no-store',credentials:'omit',headers:{...(data?{'content-type':'application/json'}:{}),...(session?{'authorization':'Bearer '+session.session,'x-csrf-token':session.csrf}:{})},...(data?{body:JSON.stringify(data)}:{})});let b=await r.json();if(!r.ok)throw Error(b.error||'Request failed');return b}
 return {async login(username,password){session=await request('/api/login','POST',{username,password});return {role:session.role,expiresAt:session.expiresAt}},async logout(){try{return await request('/api/logout','POST',{})}finally{session=null}},catalog:()=>request('/api/catalog'),createOrder:(id,items)=>request('/api/orders','POST',{id,request:{items}}),getOrder:id=>request('/api/orders?id='+encodeURIComponent(id)),reserve:(id,orderId,idempotencyKey)=>request('/api/attempts','POST',{id,orderId,idempotencyKey}),getAttempt:id=>request('/api/attempts?id='+encodeURIComponent(id))};
}
