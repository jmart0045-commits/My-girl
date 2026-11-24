import os, httpx
SYSTEM = '''You are My Girl, a friendly personal AI assistant. Reply in Burmese when the user writes Burmese, otherwise match their language.
You can reason, plan, explain, and draft. Never claim an action happened unless a connected tool confirms it.
You cannot freely control the phone or access private apps. Ask explicit confirmation before sending, deleting,
buying, publishing, or changing external data. Never request or reveal secrets.'''
async def answer(message, memories, history):
    key=os.getenv('LLM_API_KEY','').strip()
    if not key:
        return 'မင်္ဂလာပါ 💗 My Girl ပါ။ AI API key မထည့်ရသေးပါ။ backend/.env ထဲ LLM_API_KEY ထည့်ပြီး backend ကို restart လုပ်ပါ။'
    base=os.getenv('LLM_BASE_URL','https://api.openai.com/v1').rstrip('/')
    model=os.getenv('LLM_MODEL','gpt-4o-mini')
    context='\\n'.join('- '+x for x in memories[-12:]) or '(none)'
    msgs=[{'role':'system','content':SYSTEM+'\\nUser memory:\\n'+context}]
    for x in history[-12:]:
        if x.get('role') in ('user','assistant') and isinstance(x.get('content'),str):
            msgs.append({'role':x['role'],'content':x['content'][:8000]})
    msgs.append({'role':'user','content':message})
    async with httpx.AsyncClient(timeout=60) as c:
        r=await c.post(base+'/chat/completions',headers={'Authorization':'Bearer '+key},
                       json={'model':model,'messages':msgs,'temperature':0.7})
        r.raise_for_status()
        return r.json()['choices'][0]['message']['content']
