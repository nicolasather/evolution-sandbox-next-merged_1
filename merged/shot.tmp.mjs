import { chromium } from '@playwright/test';
const [,, url, out, w='1280', h='720', wait='2500', actions=''] = process.argv;
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args:['--no-sandbox'] }).catch(async()=>chromium.launch({args:['--no-sandbox']}));
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, bypassCSP: true }); const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', e.message)); p.on('console', m => { if (m.type()==='error') console.log('CONSOLE', m.text().slice(0,200)); });
await p.addInitScript(() => { try { localStorage.setItem('qz:os:coach','1'); localStorage.setItem('qz:td:coach','1'); localStorage.setItem('qz:td:coach:v1','1'); } catch {} });
await p.goto(url, { waitUntil: 'networkidle' }).catch(()=>{});
for (const a of actions.split('|').filter(Boolean)) { const [k,v]=a.split('='); if(k==='click') await p.getByRole('button',{name:v}).first().click(); if(k==='key') await p.keyboard.press(v); if(k==='hold'){await p.keyboard.down(v); await p.waitForTimeout(+wait);} if(k==='wait') await p.waitForTimeout(+v); if(k==='text') await p.getByText(v).first().click(); }
await p.waitForTimeout(+wait);
await p.screenshot({ path: out });
await b.close();
