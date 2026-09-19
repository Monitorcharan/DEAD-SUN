import json, os, subprocess, tempfile, time, urllib.request, urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def request(path, data=None, headers=None):
    payload=json.dumps(data).encode() if isinstance(data,dict) else data
    req=urllib.request.Request('http://127.0.0.1:3092'+path,data=payload,headers=headers or {})
    try:
        with urllib.request.urlopen(req,timeout=5) as r:return r.status,r.read(),r.headers
    except urllib.error.HTTPError as e:return e.code,e.read(),e.headers
with tempfile.TemporaryDirectory() as tmp:
    env={**os.environ,'PORT':'3092','SCORES_FILE':str(Path(tmp)/'scores.json'),'ADMIN_TOKEN':'qa-token'}
    env.pop('DATABASE_URL',None);env.pop('RENDER',None)
    proc=subprocess.Popen(['node','server/server.js'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                if request('/api/health')[0]==200:break
            except OSError:time.sleep(.1)
        for path in ['/server/scores.json','/server/server.js','/.git/config','/package.json','/%2e%2e/server/server.js','/.env']:
            assert request(path)[0]==404,path
        code,body,headers=request('/')
        assert code==200 and "object-src 'none'" in headers['Content-Security-Policy']
        assert request('/api/admin/clear-database',b'',{'Authorization':'Bearer '+('é'*8)})[0]==403
        assert request('/api/admin/clear-database?admin_token=qa-token',b'')[0]==403
        assert request('/api/leaderboard?difficulty=BAD')[0]==400
        valid={'callsign':'QA','distance':100,'time':10,'shelters':1,'seed':123,'difficulty':'EASY'}
        assert request('/api/score',{**valid,'distance':'100'})[0]==400
        assert request('/api/score',b'x'*4097)[0]==413
        assert request('/api/score',valid)[0]==200
        assert len(json.loads(request('/api/leaderboard?difficulty=EASY')[1])['leaderboard'])==1
        assert len(json.loads(request('/api/leaderboard?difficulty=HARDCORE')[1])['leaderboard'])==0
        assert request('/api/score',{**valid,'difficulty':'HARDCORE'})[0]==200
        assert request('/api/score',{**valid,'time':float('nan')})[0]==400
        assert request('/api/score',valid,{'X-Forwarded-For':'1.2.3.4'})[0]==429
        assert request('/api/admin/clear-database',b'',{'Authorization':'Bearer qa-token'})[0]==200
        assert not json.loads(request('/api/leaderboard?difficulty=EASY')[1])['leaderboard']
        print('PASS: private files, CSP, malformed/oversized scores, difficulty isolation, rate limiting, admin authentication')
    finally:proc.terminate();proc.wait(timeout=5)
