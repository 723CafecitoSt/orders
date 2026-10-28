// Only the explicitly configured test deployment can reach data routes. No Square client is imported.
import {sandboxApi} from './sandbox-api.mjs';
export default {async fetch(request,env){
 if(env.APP_MODE!=='private_test'||env.TEST_ENABLED!=='true'||env.PAYMENTS_ENABLED!=='false')return Response.json({status:'disabled'},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
 return sandboxApi(request,env);
}};
