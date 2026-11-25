const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
  const page = await browser.newPage({serviceWorkers:'block', viewport:{width:390,height:844}, timezoneId:'America/Los_Angeles'});
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('tpe-trash-favs','broken json'));
  if (!process.env.TEST_URL) await page.route('http://localhost/**', async route => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const file = require('node:path').join(__dirname, '..', pathname.endsWith('/') ? pathname + 'index.html' : pathname);
    await route.fulfill({path:file});
  });
  await page.goto(process.env.TEST_URL || 'http://localhost/');
  assert(await page.evaluate(() => Math.abs(tpeNow().getTime() - Date.now() - 8 * 3600000) < 1000));
  await page.selectOption('#city','大安區');
  await page.locator('button.stop-item').first().waitFor();
  // Exercise policy denial with a real browser Permissions-Policy response header.
  await page.route('http://localhost/policy', async r => r.fulfill({path:require('node:path').join(__dirname,'../index.html'),headers:{'Permissions-Policy':'geolocation=()'}}));
  const original = page.url();
  await page.goto('http://localhost/policy');
  await page.selectOption('#city','大安區');
  await page.locator('button.stop-item').first().waitFor();
  await page.click('#geoBtn');
  assert.match(await page.locator('#geoMessage').innerText(), /安全設定暫未開放定位/);
  await page.getByRole('button',{name:'改用手動查詢'}).click();
  assert(await page.locator('#q').evaluate(e=>e===document.activeElement));
  await page.goto(original);
  await page.selectOption('#city','大安區');
  await page.locator('button.stop-item').first().waitFor();
  for (const code of [1,2,3]) {
    await page.evaluate(code=>{navigator.geolocation.getCurrentPosition=(_,fail)=>fail({code,message:'English error'});},code);
    await page.click('#geoBtn');
    const message=await page.locator('#geoMessage').innerText();
    assert(!message.includes('English error'));
    assert.match(message, /權限|無法取得位置|逾時/);
    assert(await page.locator('#geoBtn').isEnabled());
  }
  await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=success=>success({coords:{latitude:25.026,longitude:121.543}});});
  // Geolocation no longer needs a district: start from an empty selection.
  await page.selectOption('#city','');
  await page.click('#geoBtn');
  await page.locator('#status',{hasText:'離你最近'}).waitFor();
  assert.equal(await page.locator('button.stop-item').count(),20);
  await page.locator('button.stop-item').first().click();
  await page.locator('.result').waitFor();
  assert.equal(await page.locator('#city').inputValue(),'大安區');
  assert.equal(await page.locator('button.stop-item').count(),20, 'nearest list is kept after choosing a stop');
  assert.match(await page.locator('.today-box').innerText(), /可以丟/);
  await page.getByRole('button',{name:'⭐ 加入常用',exact:true}).click();
  assert.equal(await page.locator('.fav-item').count(),1);
  assert.match(await page.locator('.fav-next').innerText(), /還有|天後|已過/);
  page.once('dialog', d => d.accept('家'));
  await page.getByRole('button',{name:/重新命名/}).click();
  assert.match(await page.locator('.fav-name').innerText(), /家/);
  // Google Calendar link carries a weekly recurrence in Taipei time.
  const gcal = await page.locator('a.gcal').first().getAttribute('href');
  assert.match(gcal, /calendar\.google\.com/);
  assert.match(decodeURIComponent(gcal), /recur=RRULE:FREQ=WEEKLY;BYDAY=MO,TU,TH,FR,SA/);
  assert.match(gcal, /ctz=Asia%2FTaipei/);
  // Grace period: a run that was due 3 minutes ago is still shown as on its way.
  assert(await page.evaluate(() => {
    const t = new Date(tpeNow().getTime() - 3 * 60000);
    const hm = `${String(t.getUTCHours()).padStart(2,'0')}:${String(t.getUTCMinutes()).padStart(2,'0')}`;
    const n = describeNext(['x','v',hm,0,0,'1111111','1111111','1111111','r']);
    return n.passed && n.passedMin >= 3 && n.passedMin <= 4 && n.soon;
  }));
  // Search normalization: Chinese numerals, 臺/台, full-width digits.
  assert.equal(await page.evaluate(() => normalize('臺北市中山北路二段１２號')), '台北市中山北路2段12號');
  assert.equal(await page.evaluate(() => normalize('一百零五巷')), '105巷');
  const cal=page.getByRole('button',{name:'📅 加入日曆（每週提醒）'});
  await cal.focus(); await page.waitForTimeout(1200);
  assert(await cal.evaluate(e=>e===document.activeElement));
  const downloadICS=async()=>{const p=page.waitForEvent('download'); await cal.click(); return require('node:fs').readFileSync(await (await p).path(),'utf8');};
  let content=await downloadICS();
  assert(content.includes('TZID=Asia/Taipei'));
  assert(content.includes('TRIGGER:-PT10M'));
  assert.equal((content.match(/BEGIN:VEVENT/g)||[]).length,3);
  for(const line of content.split('\r\n')) assert(Buffer.byteLength(line)<=75);
  // Reminder preferences: lead time and which collection types.
  await page.locator('.cal-opts summary').click();
  await page.selectOption('#calLead','30');
  await page.locator('[data-type="f"]').uncheck();
  content=await downloadICS();
  assert(content.includes('TRIGGER:-PT30M'));
  assert.equal((content.match(/BEGIN:VEVENT/g)||[]).length,2);
  await page.locator('[data-type="f"]').check();
  await page.selectOption('#calLead','10');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.selectOption('#city','');
  assert.equal(await page.locator('.result').count(),0);
  assert(await page.locator('#q').isDisabled());
  await page.evaluate(()=>cityCache.clear());
  await page.route('**/data/' + encodeURIComponent('信義區') + '.json',r=>r.fulfill({status:503,body:'unavailable'}));
  await page.selectOption('#city','信義區');
  await page.getByRole('button',{name:'重新載入',exact:true}).waitFor();
  await page.unroute('**/data/' + encodeURIComponent('信義區') + '.json');
  await page.getByRole('button',{name:'重新載入',exact:true}).click();
  await page.locator('button.stop-item').first().waitFor();
  await page.selectOption('#city','中山區');
  await page.locator('button.stop-item').first().waitFor();
  await page.fill('#q','中山北路一段');
  assert((await page.locator('button.stop-item').count())>0, 'Chinese numeral road section matches');
  // Same address with several runs is one list item and offers the other slots.
  await page.fill('#q','中山北路1段35號');
  assert.equal(await page.locator('button.stop-item').count(),1);
  await page.locator('button.stop-item').first().click();
  assert.equal(await page.locator('.slot').count(),2);
  await page.locator('.slot').nth(1).click();
  assert.match(await page.locator('.route').innerText(), /21:51/);
  await page.fill('#q','不存在的清運地點');
  assert.equal(await page.locator('button.stop-item').count(),0);
  assert.deepEqual(errors,[]);
  await page.fill('#q','');
  await page.screenshot({path:'/tmp/trash-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('button.stop-item').first().click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'/tmp/trash-desktop.png',fullPage:true});
  // Static district/village pages deep-link into the app with a selected stop.
  await page.goto('http://localhost/' + encodeURIComponent('大安區') + '/');
  assert.match(await page.locator('h1').innerText(), /大安區垃圾車時間/);
  await page.locator('.links a').first().click();
  assert.match(await page.locator('h1').innerText(), /大安區.+里垃圾車時間/);
  const stopName = await page.locator('tbody tr td').nth(1).innerText();
  await page.locator('tbody a').first().click();
  await page.locator('.result').waitFor();
  assert((await page.locator('.sname').innerText()).includes(stopName));
  assert.deepEqual(errors,[]);
  // LINE in-app browser gets a hint to reopen in the system browser.
  const line = await browser.newPage({serviceWorkers:'block', userAgent:'Mozilla/5.0 (iPhone) AppleWebKit Mobile Line/14.0.0'});
  if (!process.env.TEST_URL) await line.route('http://localhost/**', r => r.fulfill({path:require('node:path').join(__dirname,'..',decodeURIComponent(new URL(r.request().url()).pathname).replace(/\/$/,'/index.html'))}));
  await line.goto((process.env.TEST_URL || 'http://localhost/') + '#' + encodeURIComponent('大安區'));
  await line.locator('button.stop-item').first().click();
  assert.match(await line.locator('.inapp a').getAttribute('href'), /openExternalBrowser=1/);
  await browser.close(); console.log('PASS: mobile layout, citywide geolocation, grouped stops, grace period, normalized search, fav countdown/rename, reminder options, Google Calendar, LINE hint, static district pages, selection, storage recovery, favorites, stable focus, calendar, empty district, retry and search');
})().catch(e=>{console.error(e);process.exit(1)});
