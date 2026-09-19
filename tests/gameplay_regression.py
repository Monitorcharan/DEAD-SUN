import asyncio,json
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch();page=await b.new_page()
  await page.goto('http://127.0.0.1:3091');await page.wait_for_function('window.deadSunGame?.playerSprite')
  result=await page.evaluate('''() => {
   const g=window.deadSunGame;g.app.ticker.stop();window.soundEngine=null;
   const runs=[];
   for(const difficulty of ['EASY','MEDIUM','HARDCORE']) {
    g._setDifficulty(difficulty);g.resetRun();g.state='PLAYING';g.paused=false;
    g.tutorialsSeen={cooling:true,overheating:true,supply:true};
    for(const obs of g.obstacles) {obs.solidBox={x:-10000,y:-10000,w:1,h:1};obs.shadowBox={x:-10000,y:-10000,w:1,h:1};}
    g.obstacles=[];g.lavaPools=[];g.supplies=[];
    g.player.x=600;g.player.y=650;g.keys={KeyD:true};
    g.lastTime=performance.now()-100;g.update();
    runs.push({difficulty,heat:g.heat,fireSpeed:g.fire.baseSpeed,flare:g.solarFlareTimer,lava:g._diff.lavaFrequency});
    g.player.stamina=3;g.player.dashCooldown=0;g.triggerDash();
    if(g.player.stamina!==2) throw Error('dash did not consume stamina');
    g.triggerDash();if(g.player.stamina!==2) throw Error('dash cooldown bypassed');
    const c=g.resolveCircleAABBCollision(10,10,5,{x:0,y:0,w:20,h:20});
    if(!c.collided || (!c.pushX && !c.pushY))throw Error('collision failed');
   }
   if(!(runs[0].heat<runs[1].heat && runs[1].heat<runs[2].heat)) throw Error('heat progression '+JSON.stringify(runs));
   if(!(runs[0].fireSpeed<runs[1].fireSpeed && runs[1].fireSpeed<runs[2].fireSpeed))throw Error('fire progression');
   if(!(runs[0].lava<runs[1].lava && runs[1].lava<runs[2].lava))throw Error('lava progression');
   g.quality='HIGH';g.frameAverage=50;g.slowFrameTime=4.1;g.lastTime=performance.now()-40;g.update();
   if(g.quality!=='LOW')throw Error('adaptive quality failed');
   return runs;
  }''')
  print('PASS: difficulty heat/fire/lava, dash cost/cooldown, collisions, adaptive quality',json.dumps(result))
  await b.close()
asyncio.run(main())
