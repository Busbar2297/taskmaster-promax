import { realpathSync, statSync, readFileSync } from 'node:fs';
import { basename, isAbsolute, join, normalize, relative, sep } from 'node:path';
const supported = new Set(['pending','in-progress','review','done','deferred','cancelled','blocked']);
const label = (v,limit=180) => typeof v==='string' ? v.trim().slice(0,limit) : '';
const id = v => typeof v==='number' && Number.isSafeInteger(v) ? String(v) : /^[a-z0-9_.-]{1,40}$/i.test(v || '') && typeof v==='string' ? v : '';
const status = v => supported.has(v) ? v : 'unknown';
const rows = (v,n) => Array.isArray(v) ? v.slice(0,n) : [];
export function parse(text,tag='master'){
  const data=JSON.parse(text), list=Array.isArray(data?.tasks)?data.tasks:Object.hasOwn(data || {},tag)?data[tag]?.tasks:null;
  if(!Array.isArray(list)) throw Error('invalid-task-list');
  if(list.length>3000) throw Error('task-limit');
  const seen=new Set(), tasks=[];
  for(const a of list){
    const key=id(a?.id); if(!key||seen.has(key)) continue; seen.add(key);
    const subs=rows(a.subtasks,500).filter(b=>id(b?.id)).map(b=>({id:id(b.id),title:label(b.title)||'Untitled subtask',status:status(b.status),dependencies:rows(b.dependencies,100).map(id).filter(Boolean)}));
    tasks.push({id:key,title:label(a.title)||'Untitled task',status:status(a.status),dependencies:rows(a.dependencies,100).map(id).filter(Boolean),subtasks:subs});
  }
  const byId=new Map(tasks.map(t=>[t.id,t]));
  for(const t of tasks){
    const subById=new Map(t.subtasks.map(s=>[s.id,s]));
    t.blockers=t.dependencies.filter(k=>byId.get(k)?.status!=='done');
    t.subtasks.forEach(s=>{s.blockers=s.dependencies.filter(k=>{const [parent,child]=k.split('.'); return (child ? (parent===t.id ? subById.get(child) : byId.get(parent)?.subtasks.find(o=>o.id===child)) : subById.get(k))?.status!=='done';});});
  }
  return tasks;
}
export function normalizeProjects(conf){
  if(!Array.isArray(conf?.projects)||!conf.projects.length||conf.projects.length>30) throw Error('Configure 1–30 project roots.');
  const seen=new Set();
  return conf.projects.map(p=>{
    const key=id(p?.id), name=label(p?.name,80);
    if(!key||!name||seen.has(key)||typeof p?.root!=='string'||!isAbsolute(p.root)||/^[\\/]{2}/.test(p.root)) throw Error('Invalid project allowlist entry.');
    const tag=p.tag===undefined?'master':id(p.tag); if(!tag) throw Error('Invalid task tag.');
    seen.add(key); return {id:key,name,root:normalize(p.root),tag};
  });
}
export function readProject(p){
  try{
    const root=realpathSync(p.root), dir=join(root,'.taskmaster','tasks'), file=join(dir,'tasks.json'), actual=realpathSync(file), rel=relative(root,actual);
    if(isAbsolute(rel)||rel.startsWith('..'+sep)||rel!==join('.taskmaster','tasks','tasks.json')) throw Error('scope');
    const st=statSync(actual); if(!st.isFile()||st.size>4000000) throw Error('size');
    return {state:'ready',tasks:parse(readFileSync(actual,'utf8').replace(/^\uFEFF/,''),p.tag)};
  }catch{return {state:'unavailable',tasks:[]};}
}
export function createTracker(projects, reader=readProject, now=()=>new Date().toISOString()){
  const state=new Map(), activity=[];
  function sample(){
    for(const p of projects){
      const next=reader(p), old=state.get(p.id);
      if(next.state==='unavailable'){
        state.set(p.id,{id:p.id,name:p.name,tag:p.tag,state:old?.observedAt?'stale':'unavailable',tasks:old?.tasks||[],observedAt:old?.observedAt??null});
        continue;
      }
      const same=old?.observedAt&&JSON.stringify(old.tasks)===JSON.stringify(next.tasks);
      const observedAt=same?old.observedAt:now();
      if(old?.observedAt&&!same){
        const before=new Map(old.tasks.map(t=>[t.id,t]));
        for(const t of next.tasks){
          const prev=before.get(t.id);
          if(!prev||prev.status!==t.status) activity.unshift({projectId:p.id,project:p.name,task:t.title,taskId:t.id,subtaskId:null,from:prev?.status??null,to:t.status,at:observedAt,actor:null});
          const oldSub=new Map((prev?.subtasks||[]).map(s=>[s.id,s]));
          for(const s of t.subtasks){const last=oldSub.get(s.id);if(!last||last.status!==s.status) activity.unshift({projectId:p.id,project:p.name,task:s.title,taskId:t.id,subtaskId:s.id,from:last?.status??null,to:s.status,at:observedAt,actor:null});}
        }
        activity.splice(60);
      }
      state.set(p.id,{id:p.id,name:p.name,tag:p.tag,state:'ready',tasks:next.tasks,observedAt});
    }
    return {projects:[...state.values()],activity:[...activity]};
  }
  return {sample};
}
