import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const width of [375,390,768,1024,1440,1920]){
 await page.setViewportSize({width,height:900});
 for(const route of ['/','/gifts','/cheese-charcuterie','/events','/contact','/gifts/leather-craft']){
  const r=await page.goto('http://localhost:8787'+route);assert.equal(r.status(),200);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow '+width+' '+route);
  if(width===390||width===1440)await page.screenshot({path:'/workspace/misa-artifacts/'+(route==='/'?'home':route.slice(1).replaceAll('/','-'))+'-'+width+'.png',fullPage:true});
 }
}
await page.goto('http://localhost:8787/gifts');await page.getByRole('button',{name:'Leather Craft',exact:true}).click();assert.equal(await page.locator('.card:visible').count(),1);await page.locator('.card:visible a').click();assert.ok(page.url().endsWith('/gifts/leather-craft'));await page.getByRole('link',{name:'Request This Item'}).click();assert.equal(await page.locator('[name=selected]').inputValue(),'Leather Craft');await page.locator('[name=name]').fill('Test');await page.locator('[name=email]').fill('test@example.com');await page.locator('[name=quantity]').fill('5');await page.getByRole('button',{name:'Check submission availability'}).click();await page.getByRole('status').filter({hasText:'not been sent'}).waitFor();
await page.goto('http://localhost:8787/');const panel=page.locator('.panel').first();await panel.hover();await page.waitForTimeout(650);assert.ok(await panel.evaluate(el=>el.getBoundingClientRect().width)>600);
assert.deepEqual(errors,[]);await browser.close();console.log('Passed: 36 responsive page checks, catalogue filtering, contextual inquiry, unavailable-delivery feedback, panel expansion; no browser errors.');
