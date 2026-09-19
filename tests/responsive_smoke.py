import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright

OUT=Path('qa'); OUT.mkdir(exist_ok=True)
async def main():
    results=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True)
        for w,h,dpr,touch in [(360,800,3,True),(800,360,3,True),(390,844,3,True),(1024,768,2,True),(1366,768,1,False),(2560,1080,2,False)]:
            context=await browser.new_context(viewport={'width':w,'height':h},device_scale_factor=dpr,has_touch=touch)
            page=await context.new_page(); errors=[]
            page.on('pageerror',lambda error: errors.append(str(error)))
            await page.goto('http://127.0.0.1:3091')
            await page.wait_for_function('window.deadSunGame?.playerSprite')
            await page.screenshot(path=str(OUT/f'menu_{w}.png'))
            bounds=await page.evaluate('''() => {
              const c=document.querySelector('#game-container').getBoundingClientRect();
              const g=window.deadSunGame;
              return {width:c.width,height:c.height,resolution:g.app.renderer.resolution,font:parseFloat(getComputedStyle(document.querySelector('#splash-callsign-input')).fontSize)};
            }''')
            assert bounds['width']==w and bounds['height']==h,bounds
            assert bounds['font']>=16 and bounds['resolution']<=1.5,bounds
            await page.fill('#splash-callsign-input','QA')
            await page.locator('#btn-start').click()
            await page.evaluate('''() => {
              const g=window.deadSunGame;
              g.closeDialogue(); g.state='PLAYING';
              g.tutorialsSeen={cooling:true,overheating:true,supply:true};
              ['transmission-layer','intro-title-banner','countdown-display'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
            }''')
            await page.keyboard.down('KeyD'); await page.wait_for_timeout(700); await page.keyboard.up('KeyD')
            await page.screenshot(path=str(OUT/f'game_{w}.png'))
            state=await page.evaluate('''() => {const g=window.deadSunGame; return {state:g.state,heat:g.heat,x:g.player.x,particles:g.particles.length,frameMs:g.frameAverage};}''')
            assert state['x']>280,state
            await page.evaluate("window.dispatchEvent(new Event('blur'))")
            assert await page.evaluate('Object.keys(window.deadSunGame.keys).length')==0
            await page.evaluate('window.deadSunGame.openControlsModal()')
            await page.screenshot(path=str(OUT/f'controls_{w}.png'))
            assert not errors,errors
            results.append({'viewport':[w,h],**bounds,**state,'errors':errors})
            await context.close()
        await browser.close()
    (OUT/'responsive-results.json').write_text(json.dumps(results,indent=2))
    print(json.dumps(results,indent=2))
asyncio.run(main())
