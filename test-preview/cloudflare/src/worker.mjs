// Deliberately non-operational security gate: no payments, login or data access.
// Do not remove this gate or deploy until authentication, CORS and CSRF are reviewed.
export default {async fetch(request,env){
 if(env.APP_MODE!=='simulation')return new Response('Disabled',{status:503,headers:{'cache-control':'no-store'}});
 return Response.json({status:'not_ready',message:'Sandbox backend is under development. No payments or customer data are accepted.'},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
}};
