// Same PBKDF2-HMAC-SHA256 result on native WebCrypto and Workers with a native iteration cap.
// Never lower the work factor to accommodate an execution platform.
import {pbkdf2Async} from '@noble/hashes/pbkdf2.js';
import {sha256} from '@noble/hashes/sha2.js';
const encoder=new TextEncoder();
export const PASSWORD_ITERATIONS=600000;
export async function passwordHash(password,salt){
 const passwordBytes=encoder.encode(password),saltBytes=encoder.encode(salt);let result;
 try{
  try{const key=await crypto.subtle.importKey('raw',passwordBytes,'PBKDF2',false,['deriveBits']);result=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:saltBytes,iterations:PASSWORD_ITERATIONS},key,256));}
  catch(e){if(e?.name!=='NotSupportedError')throw e;result=await pbkdf2Async(sha256,passwordBytes,saltBytes,{c:PASSWORD_ITERATIONS,dkLen:32,asyncTick:10});}
  return Array.from(result,x=>x.toString(16).padStart(2,'0')).join('');
 }catch{throw Object.assign(new Error('Password derivation unavailable'),{code:'password_hash_unavailable'})}
 finally{passwordBytes.fill(0);saltBytes.fill(0);result?.fill(0)}
}
