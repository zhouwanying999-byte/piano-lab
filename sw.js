'use strict';
const cachePrefix='piano-lab:'+self.registration.scope+':';
const cacheName=cachePrefix+'v1';
const appFiles=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(appFiles)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(key=>key.startsWith(cachePrefix)&&key!==cacheName).map(key=>caches.delete(key))
  )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const {request}=event;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(url.search)return;
  const scope=self.registration.scope;
  if(request.mode==='navigate' && url.href.startsWith(scope)){
    event.respondWith(fetch(request).catch(()=>caches.match(new URL('./index.html',scope).href,{cacheName})));
  }else if(appFiles.some(file=>new URL(file,scope).href===url.href)){
    event.respondWith(caches.match(request,{cacheName}).then(cached=>cached||fetch(request)));
  }
});
