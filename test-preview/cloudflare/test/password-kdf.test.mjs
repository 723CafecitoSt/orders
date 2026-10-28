import {test} from 'node:test';import assert from 'node:assert/strict';import {pbkdf2Sync} from 'node:crypto';
import {passwordHash,PASSWORD_ITERATIONS} from '../src/password-kdf.mjs';
import {createStaff,login} from '../src/auth.mjs';import {testDatabase} from './helpers.mjs';
test('Workers native iteration ceiling uses the identical 600000-round SHA256 result, including UTF8',async()=>{
 assert.equal(PASSWORD_ITERATIONS,600000);const original=crypto.subtle.deriveBits;
 try{for(const password of ['test-password-123','Cafecito-contraseña-☕-2026']){let salt='a0123456789abcdef';const expected=pbkdf2Sync(password,salt,600000,32,'sha256').toString('hex');assert.equal(await passwordHash(password,salt),expected);crypto.subtle.deriveBits=async()=>{throw new DOMException('Production ceiling','NotSupportedError')};assert.equal(await passwordHash(password,salt),expected);crypto.subtle.deriveBits=original;}}
 finally{crypto.subtle.deriveBits=original}
});
test('fallback can bootstrap, log in and reject wrong password without changing existing hash format',async()=>{
 let {raw,db}=testDatabase(),original=crypto.subtle.deriveBits;crypto.subtle.deriveBits=async()=>{throw new DOMException('Production ceiling','NotSupportedError')};
 try{await createStaff(db,{id:'fallback_admin',username:'fallback_admin',password:'test-password-123',role:'administrator',bootstrap:true});let stored=raw.prepare('SELECT password_hash,salt FROM employees').get();assert.equal(stored.password_hash,pbkdf2Sync('test-password-123',stored.salt,600000,32,'sha256').toString('hex'));assert.equal(raw.prepare('SELECT COUNT(*) n FROM bootstrap_once').get().n,1);assert.equal(await login(db,'fallback_admin','incorrect-password'),null);assert((await login(db,'fallback_admin','test-password-123')).permissions.includes('administrator'));}
 finally{crypto.subtle.deriveBits=original;raw.close()}
});
