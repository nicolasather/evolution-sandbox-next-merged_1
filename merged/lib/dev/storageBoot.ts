/* ============================================================================
   BETA STORAGE NAMESPACE.

   The beta lives on its own origin (a Vercel preview URL), and browsers keep
   localStorage per origin, so a beta tester's progress can never reach the
   production site's data. This script is a SECOND wall on top of that: it runs
   before any app code and re-points `window.localStorage` at keys prefixed
   `evo-beta:`. So even if the beta were ever served from the same origin as
   production (a custom domain, a rewrite), it still could not read or
   overwrite a production save, and a production page could not read the
   beta's.

   It is only ever written into the page when the build is the Developer Beta
   (app/layout.tsx). If the browser refuses to redefine localStorage, the page
   keeps working on the plain storage and `window.__EVO_BETA_STORAGE__` stays
   undefined — the console reports "namespace: OFF" so nobody is misled.
   ========================================================================== */

export const BETA_STORAGE_PREFIX = 'evo-beta:';

export const DEV_STORAGE_BOOT = `(function(){try{
var real=window.localStorage,P=${JSON.stringify(BETA_STORAGE_PREFIX)};
function keys(){var o=[];for(var i=0;i<real.length;i++){var k=real.key(i);if(k&&k.indexOf(P)===0)o.push(k.slice(P.length));}return o;}
var ns={
getItem:function(k){return real.getItem(P+k);},
setItem:function(k,v){real.setItem(P+k,String(v));},
removeItem:function(k){real.removeItem(P+k);},
clear:function(){keys().forEach(function(k){real.removeItem(P+k);});},
key:function(i){var a=keys();return a[i]===undefined?null:a[i];}
};
Object.defineProperty(ns,'length',{get:function(){return keys().length;}});
Object.defineProperty(window,'localStorage',{configurable:true,get:function(){return ns;}});
window.__EVO_BETA_STORAGE__={prefix:P};
}catch(e){}})();`;

/** Is the namespace active in this page? (Client only.) */
export function betaStorageActive(): boolean {
  return typeof window !== 'undefined'
    && !!(window as unknown as { __EVO_BETA_STORAGE__?: unknown }).__EVO_BETA_STORAGE__;
}
