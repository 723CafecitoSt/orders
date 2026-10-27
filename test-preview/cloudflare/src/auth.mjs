// Development-only implementation. Never open public access before security review.
const encoder=new TextEncoder();const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const usernameOK=u=>typeof u==='string'&&/^[A-Za-z0-9_-]{3,40}$/.test(u);
const ITERATIONS=600000;
async function digest(s){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)))}
async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:ITERATIONS},key,256))}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
export async function createStaff(db,{id,username,password,role='cashier'}){if(!/^[A-Za-z0-9_-]{8,64}$/.test(id)||!usernameOK(username)||typeof password!=='string'||password.length<12||password.length>200||!['admin','cashier'].includes(role))throw Error('Invalid staff');let salt=hex(crypto.getRandomValues(new Uint8Array(16))),hash=await passwordHash(password,salt);await db.prepare('INSERT INTO employees(id,username,password_hash,salt,enabled,role) VALUES(?,?,?,?,1,?)').bind(id,username,hash,salt,role).run()}
export async function login(db,username,password,now=Date.now()){
 if(!usernameOK(username)||typeof password!=='string'||password.length>200)return null;
 let attempt=await db.prepare('SELECT failures,blocked_until FROM login_failures WHERE username=?').bind(username).first();if(attempt&&attempt.blocked_until>now)return null;
 let u=await db.prepare('SELECT id,password_hash,salt,role FROM employees WHERE username=? AND enabled=1').bind(username).first();let calculated=await passwordHash(password,u?.salt||'0'.repeat(32));
 if(!u||!equal(calculated,u.password_hash)){await db.prepare('INSERT INTO login_failures(username,failures,blocked_until) VALUES(?,1,0) ON CONFLICT(username) DO UPDATE SET failures=CASE WHEN blocked_until>0 AND blocked_until<=? THEN 1 ELSE failures+1 END, blocked_until=CASE WHEN (CASE WHEN blocked_until>0 AND blocked_until<=? THEN 1 ELSE failures+1 END)>=5 THEN ? ELSE 0 END').bind(username,now,now,now+900000).run();return null}
 await db.prepare('DELETE FROM login_failures WHERE username=?').bind(username).run();const session=hex(crypto.getRandomValues(new Uint8Array(32))),csrf=hex(crypto.getRandomValues(new Uint8Array(32))),expiry=now+28800000;
 await db.prepare('INSERT INTO sessions(id_hash,employee_id,csrf_hash,expires_at) VALUES(?,?,?,?)').bind(await digest(session),u.id,await digest(csrf),expiry).run();return {session,csrf,expiresAt:expiry,role:u.role};
}
export async function authorize(db,session,csrf,requiredRole='cashier',now=Date.now()){
 if(!/^[0-9a-f]{64}$/.test(session||'')||!/^[0-9a-f]{64}$/.test(csrf||'')||!['admin','cashier'].includes(requiredRole))return null;
 let row=await db.prepare('SELECT s.csrf_hash,s.expires_at,e.id,e.role,e.enabled FROM sessions s JOIN employees e ON e.id=s.employee_id WHERE s.id_hash=?').bind(await digest(session)).first();
 if(!row||row.enabled!==1||row.expires_at<=now||!equal(row.csrf_hash,await digest(csrf))||(requiredRole==='admin'&&row.role!=='admin'))return null;return {id:row.id,role:row.role};
}
export async function logout(db,session){if(/^[0-9a-f]{64}$/.test(session||''))await db.prepare('DELETE FROM sessions WHERE id_hash=?').bind(await digest(session)).run()}
