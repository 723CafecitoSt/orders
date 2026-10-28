// Passwords are hashed with PBKDF2. Session and CSRF values are random and stored only as hashes.
const encoder=new TextEncoder(),hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const usernameOK=u=>typeof u==='string'&&/^[A-Za-z0-9_-]{3,40}$/.test(u),ITERATIONS=600000;
const digest=async s=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)));
async function passwordHash(password,salt){try{const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:ITERATIONS},key,256))}catch{throw Object.assign(new Error('Password derivation unavailable'),{code:'password_hash_unavailable'})}}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
export async function createStaff(db,{id,username,password,role='cashier',actorId=null,bootstrap=false}){
 const permissions=role==='kitchen'?['beverages','food']:[role==='admin'?'administrator':role],permission=permissions[0];
 if(!/^[A-Za-z0-9_-]{8,64}$/.test(id)||!usernameOK(username)||typeof password!=='string'||password.length<14||password.length>200||!permissions.every(p=>['administrator','cashier','beverages','food'].includes(p))||(bootstrap&&permission!=='administrator'))throw Object.assign(new Error('Invalid staff'),{code:'invalid_staff'});
 let salt=hex(crypto.getRandomValues(new Uint8Array(16))),hash=await passwordHash(password,salt),now=Date.now(),statements=[];
 if(bootstrap)statements.push(db.prepare('INSERT INTO bootstrap_once(singleton,created_at) VALUES(1,?)').bind(now));
 statements.push(db.prepare('INSERT INTO employees(id,username,password_hash,salt,enabled,role) VALUES(?,?,?,?,1,?)').bind(id,username,hash,salt,permission==='administrator'?'admin':'cashier'));
 for(const p of permissions){statements.push(db.prepare('INSERT INTO employee_permissions(employee_id,permission) VALUES(?,?)').bind(id,p));if(['beverages','food'].includes(p))statements.push(db.prepare('INSERT INTO kitchen_access(employee_id,station) VALUES(?,?)').bind(id,p));}
 statements.push(db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actorId,'employee_created',id,now,JSON.stringify({permissions,bootstrap})));
 await db.batch(statements);return {id,username,permission:permissions.length===1?permission:'kitchen',permissions};
}
export async function permissionsFor(db,id){let [p,k]=await db.batch([db.prepare('SELECT permission FROM employee_permissions WHERE employee_id=?').bind(id),db.prepare('SELECT station FROM kitchen_access WHERE employee_id=?').bind(id)]);return [...new Set([...p.results.map(x=>x.permission),...k.results.map(x=>x.station)])]}
export async function login(db,username,password,now=Date.now()){
 if(!usernameOK(username)||typeof password!=='string'||password.length>200)return null;
 let attempt=await db.prepare('SELECT failures,blocked_until FROM login_failures WHERE username=?').bind(username).first();if(attempt&&attempt.blocked_until>now)return null;
 let u=await db.prepare('SELECT id,password_hash,salt FROM employees WHERE username=? AND enabled=1').bind(username).first(),calculated=await passwordHash(password,u?.salt||'0'.repeat(32));
 if(!u)return null;
 if(!equal(calculated,u.password_hash)){await db.prepare('INSERT INTO login_failures(username,failures,blocked_until) VALUES(?,1,0) ON CONFLICT(username) DO UPDATE SET failures=CASE WHEN blocked_until>0 AND blocked_until<=? THEN 1 ELSE failures+1 END,blocked_until=CASE WHEN (CASE WHEN blocked_until>0 AND blocked_until<=? THEN 1 ELSE failures+1 END)>=5 THEN ? ELSE 0 END').bind(username,now,now,now+900000).run();return null}
 const session=hex(crypto.getRandomValues(new Uint8Array(32))),csrf=hex(crypto.getRandomValues(new Uint8Array(32))),expiry=now+3600000,permissions=await permissionsFor(db,u.id);
 await db.batch([db.prepare('DELETE FROM login_failures WHERE username=?').bind(username),db.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now),db.prepare('INSERT INTO sessions(id_hash,employee_id,csrf_hash,expires_at) VALUES(?,?,?,?)').bind(await digest(session),u.id,await digest(csrf),expiry),db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.id,'login',u.id,now,'{}')]);
 return {session,csrf,expiresAt:expiry,permissions,role:permissions.includes('administrator')?'admin':permissions.includes('cashier')?'cashier':permissions[0]||'none'};
}
export async function authorize(db,session,csrf,requiredRole='cashier',now=Date.now()){
 if(!/^[0-9a-f]{64}$/.test(session||'')||!/^[0-9a-f]{64}$/.test(csrf||'')||!['admin','cashier','beverages','food','authenticated'].includes(requiredRole))return null;
 let row=await db.prepare('SELECT s.csrf_hash,s.expires_at,e.id,e.enabled FROM sessions s JOIN employees e ON e.id=s.employee_id WHERE s.id_hash=?').bind(await digest(session)).first();
 if(!row||row.enabled!==1||row.expires_at<=now||!equal(row.csrf_hash,await digest(csrf)))return null;let permissions=await permissionsFor(db,row.id),required=requiredRole==='admin'?'administrator':requiredRole;
 if(required!=='authenticated'&&!permissions.includes('administrator')&&!permissions.includes(required))return null;
 return {id:row.id,permissions,role:permissions.includes('administrator')?'admin':permissions.includes('cashier')?'cashier':permissions[0]||'none'};
}
export async function logout(db,session){if(!/^[0-9a-f]{64}$/.test(session||''))return;let idHash=await digest(session),existing=await db.prepare('SELECT employee_id FROM sessions WHERE id_hash=?').bind(idHash).first();if(!existing)return;await db.batch([db.prepare('DELETE FROM sessions WHERE id_hash=?').bind(idHash),db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),existing.employee_id,'logout',existing.employee_id,Date.now(),'{}')])}
export async function revokeStaff(db,{id,actorId,disable=false}){if(!/^[A-Za-z0-9_-]{8,64}$/.test(id)||id===actorId&&disable)throw Error('Invalid target');let statements=[db.prepare('DELETE FROM sessions WHERE employee_id=?').bind(id)];if(disable)statements.push(db.prepare('UPDATE employees SET enabled=0 WHERE id=?').bind(id));statements.push(db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actorId,'employee_sessions_revoked',id,Date.now(),JSON.stringify({disable})));await db.batch(statements)}
