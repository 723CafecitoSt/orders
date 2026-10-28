const CACHE='723-pricing-test-v7';
const STATIC=['./','./index.html','./icon.svg','./test-backend-config.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('723-pricing-test-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
 // Never intercept/cache cross-origin requests, authenticated responses, or any API route.
 if(request.method!=='GET'||url.origin!==scope.origin||request.headers.has('authorization')||request.headers.has('x-csrf-token')||url.pathname.includes('/api/'))return;
 if(!STATIC.some(path=>new URL(path,scope).pathname===url.pathname))return;
 event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}return response}).catch(()=>caches.open(CACHE).then(cache=>cache.match(request))));
});
