from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from .db import db, init_db
from .agent import answer
load_dotenv()
app=FastAPI(title='My Girl V2 API',version='2.0.0')
app.add_middleware(CORSMiddleware,allow_origins=['*'],allow_methods=['*'],allow_headers=['*'])
@app.on_event('startup')
def startup(): init_db()
class Chat(BaseModel):
    user_id:str=Field(default='default',max_length=80)
    message:str=Field(min_length=1,max_length=12000)
    history:list[dict]=[]
class Task(BaseModel):
    title:str=Field(min_length=1,max_length=300)
    run_at:str|None=None
class Action(BaseModel):
    user_id:str='default'
    action:str=Field(min_length=1,max_length=200)
    approved:bool=False
@app.get('/health')
def health(): return {'ok':True,'agent':'My Girl V2'}
@app.post('/api/chat')
async def chat(x:Chat):
    with db() as c:
        mem=[r['content'] for r in c.execute('SELECT content FROM memories WHERE user_id=? ORDER BY id DESC LIMIT 12',(x.user_id,)).fetchall()]
    try: reply=await answer(x.message,list(reversed(mem)),x.history)
    except Exception as e: raise HTTPException(502,'AI provider error: '+str(e)[:200])
    if any(k in x.message.lower() for k in ('remember this','မှတ်ထား','မှတ်ထားပေး')):
        with db() as c: c.execute('INSERT INTO memories(user_id,content) VALUES(?,?)',(x.user_id,x.message[:1000]))
    return {'reply':reply}
@app.get('/api/memory/{uid}')
def memories(uid):
    with db() as c: rows=c.execute('SELECT id,content,created_at FROM memories WHERE user_id=? ORDER BY id DESC',(uid,)).fetchall()
    return {'items':[dict(r) for r in rows]}
@app.delete('/api/memory/{uid}')
def clear_memory(uid):
    with db() as c: c.execute('DELETE FROM memories WHERE user_id=?',(uid,))
    return {'deleted':True}
@app.post('/api/tasks/{uid}')
def add_task(uid:str,x:Task):
    with db() as c:
        cur=c.execute('INSERT INTO tasks(user_id,title,run_at) VALUES(?,?,?)',(uid,x.title,x.run_at))
        return {'id':cur.lastrowid,'title':x.title,'status':'PENDING'}
@app.get('/api/tasks/{uid}')
def tasks(uid):
    with db() as c: rows=c.execute('SELECT id,title,status,run_at,created_at FROM tasks WHERE user_id=? ORDER BY id DESC',(uid,)).fetchall()
    return {'items':[dict(r) for r in rows]}
@app.post('/api/actions/execute')
def execute(x:Action):
    with db() as c: c.execute('INSERT INTO audit(user_id,action,approved) VALUES(?,?,?)',(x.user_id,x.action,int(x.approved)))
    if not x.approved: raise HTTPException(403,'User approval required.')
    raise HTTPException(501,'No external action adapter configured. No action was executed.')
