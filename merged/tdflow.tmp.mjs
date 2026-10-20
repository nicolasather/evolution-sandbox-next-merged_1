import { chromium } from '@playwright/test';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args:['--no-sandbox'] }).catch(()=>chromium.launch({args:['--no-sandbox']}));
const ctx = await b.newContext({ viewport: { width: +(process.argv[2]||1280), height: +(process.argv[3]||800) }, bypassCSP: true }); const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.addInitScript(() => { try { localStorage.setItem('qz:td:coach:v1','1'); } catch {} });
await p.goto('http://localhost:3100/quiz/td/practice', { waitUntil: 'networkidle' }).catch(()=>{});
await p.getByTestId('td-practice-go').click();
await p.getByRole('button', { name: 'Start practice' }).click();
const phase = () => p.locator('.td').first().getAttribute('data-phase');
async function waitPhase(want, ms=90000){ const t=Date.now(); while(Date.now()-t<ms){ const ph=await phase(); if(want.includes(ph)) return ph; await p.waitForTimeout(250);} throw new Error('timeout '+await phase()); }
async function answer(){ const q=p.locator('.td-quiz'); const txt=q.locator('input[type="text"], input:not([type]), textarea'); if(await txt.count()){ for(let i=0;i<await txt.count();i++) await txt.nth(i).fill('56'); } else { const o=q.locator('button').filter({hasNotText:/Read aloud|Submit/i}); if(await o.count()) await o.last().click({timeout:3000}).catch(()=>{}); } await q.getByRole('button',{name:/Submit/i}).click({timeout:3000}).catch(()=>{}); }
await waitPhase(['quiz_open']); await p.waitForTimeout(500); await answer();
await waitPhase(['build']); await p.waitForTimeout(1500);
await p.screenshot({ path: '/tmp/shots/td_build.png' });
// open a pad
const pad = p.locator('.td button[aria-label*="pad" i], .td [data-pad]').first(); if (await pad.count()) { await pad.click().catch(()=>{}); await p.waitForTimeout(600); await p.screenshot({ path: '/tmp/shots/td_pad.png' }); }
await p.getByRole('button',{name:/^READY/}).first().click().catch(()=>{});
await waitPhase(['wave','wave_result'],60000).catch(()=>{}); await p.waitForTimeout(6000);
await p.screenshot({ path: '/tmp/shots/td_wave.png' });
await b.close();
