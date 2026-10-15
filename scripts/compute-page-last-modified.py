#!/usr/bin/env python3
"""Compute the last content-change date of every sitemap page from git history.

Writes src/app/data/page-last-modified.json (route -> {lang: YYYY-MM-DD}) and, with
--sitemap, rewrites each <lastmod> in public/sitemap.xml from it. Run from the repo root:

    python3 scripts/compute-page-last-modified.py --sitemap

A page's date is the newest commit that changed its own content: its block in
learn-detail.ts / feature-detail.ts / broker-pages.ts / video-detail.ts, its section of
public/i18n/<lang>.json, or (for static pages) its component files. Shared templates are ignored.
Run it after committing content changes, then commit the JSON and sitemap.
"""
import json,subprocess,re,hashlib,sys
def sh(*a):return subprocess.run(a,capture_output=True,text=True).stdout
def hist(path):
    out=sh('git','log','--reverse','--format=%H %ad','--date=short','--',path).split('\n')
    return [l.split() for l in out if l.strip()]
def subtree_dates(path,getters):
    """getters: name -> fn(json)->obj. returns name->last date content changed"""
    last={};prev={}
    for h,d in hist(path):
        try:j=json.loads(sh('git','show',f'{h}:{path}'))
        except Exception:continue
        for n,g in getters.items():
            try:v=g(j)
            except Exception:v=None
            hv=hashlib.md5(json.dumps(v,sort_keys=True).encode()).hexdigest() if v is not None else None
            if n not in prev or prev[n]!=hv:
                if hv is not None:last[n]=d
                prev[n]=hv
    return last
def filedate(*paths):
    ds=[sh('git','log','-1','--format=%ad','--date=short','--',p).strip() for p in paths]
    return max([d for d in ds if d] or [''])

def block_dates(path):
    last={};prev={}
    for h,d in hist(path):
        t=sh('git','show',f'{h}:{path}')
        lines=t.split('\n');idx=[(i,re.match(r"\s*slug: '([^']+)',",l).group(1)) for i,l in enumerate(lines) if re.match(r"\s*slug: '([^']+)',",l)]
        cur={}
        for n,(i,slug) in enumerate(idx):
            j=idx[n+1][0] if n+1<len(idx) else len(lines)
            b=lines[i:j]
            while b and re.match(r"^\s*([}\]],?|'?[\w-]+'?: [\{\[]|\{|\[)\s*$",b[-1]):b.pop()
            cur.setdefault(slug,[]).extend(b)
        for slug,b in cur.items():
            hv=hashlib.md5('\n'.join(b).encode()).hexdigest()
            if prev.get(slug)!=hv:last[slug]=d;prev[slug]=hv
    return last
BD={'learn':block_dates('src/app/pages/learn/learn-detail.ts'),'features':block_dates('src/app/pages/features/feature-detail.ts'),'brokers':block_dates('src/app/pages/brokers/broker-pages.ts'),'videos':block_dates('src/app/pages/videos/video-detail.ts')}
BD['blog']=BD['learn']
sm=open('public/sitemap.xml').read()
locs=re.findall(r'<loc>https://invest-begin.com/(\w\w)(/[^<]*)?</loc>',sm)
# per-language i18n subtree getters
def g(*keys):
    def f(j):
        for k in keys:j=j[k]
        return j
    return f
getters={}
static={'':('home',),'login':('login',),'signup':('signup',),'contact':('contact',),'terms':('terms','legal'),'privacy':('privacy','legal'),'disclaimer':('disclaimer','legal'),'collecting-data':('collectingData',),'knowledge-base':('sitemap',)}
for page,keys in static.items():
    for k in keys:getters[f'S:{page}:{k}']=g(k)
slugs=set(); 
for lang,p in locs:
    m=re.match(r'/(learn|blog|features|brokers|videos)/(.+)',p or '')
    if m:slugs.add(m.groups())
for kind,s in slugs:
    if kind in('learn','blog'):getters[f'L:{s}']=g('learnPages',s)
    if kind=='features':getters[f'F:{s}']=g('featurePages',s)
    if kind=='videos':getters[f'V:{s}']=g('videoPages',s)
getters['B']=g('brokerDetail')
dates={lang:subtree_dates(f'public/i18n/{lang}.json',getters) for lang in('en','ar')}
filemap={'':['src/app/pages/home.ts','src/app/pages/home.html'],'login':['src/app/pages/login.ts','src/app/pages/login.html'],'signup':['src/app/pages/signup.ts','src/app/pages/signup.html'],'contact':['src/app/pages/contact.ts','src/app/pages/contact.html'],'terms':['src/app/pages/terms.ts'],'privacy':['src/app/pages/privacy.ts'],'disclaimer':['src/app/pages/disclaimer.ts'],'collecting-data':['src/app/pages/collecting-data.ts'],'knowledge-base':['src/app/pages/sitemap.ts','src/app/pages/sitemap.html']}
res={}
for lang,p in locs:
    p=p or ''
    key=p.strip('/')
    m=re.match(r'(learn|blog|features|brokers|videos)/(.+)',key)
    cands=[]
    if m:
        kind,s=m.groups();D=dates[lang]
        bd=BD[kind].get(s,'')
        if not bd:print('no block',kind,s)
        i18n={'learn':'L','blog':'L','features':'F','videos':'V'}.get(kind)
        cands=[bd,D.get(f'{i18n}:{s}','') if i18n else '']
    else:
        cands=[D for D in [filedate(*filemap[key])]]
        for k in static[key]:cands.append(dates[lang].get(f'S:{key}:{k}',''))
    res[f'/{lang}{p}']=max(c for c in cands if c) if any(cands) else ''
out={}
for k,v in res.items():
    lang,route=k[1:3],k[3:] or '/'
    out.setdefault(route,{})[lang]=v
json.dump(out,open('src/app/data/page-last-modified.json','w'),indent=2,ensure_ascii=False);open('src/app/data/page-last-modified.json','a').write('\n')
if '--sitemap' in sys.argv:
    def f(m):
        return m.group(0).replace(m.group(2),res[m.group(1).replace('https://invest-begin.com','')] or m.group(2))
    t=re.sub(r'<loc>(https://invest-begin.com[^<]*)</loc>\s*<lastmod>([^<]*)</lastmod>',f,open('public/sitemap.xml').read())
    open('public/sitemap.xml','w').write(t)
miss=[k for k,v in res.items() if not v];print('missing',miss)
