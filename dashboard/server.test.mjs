import test from 'node:test';import assert from 'node:assert/strict';
import {once} from 'node:events';import {request} from 'node:http';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {makeServer,stableReader} from './server.mjs';
test('rolling readers hold the last observation until a second matching read',()=>{
 let status='pending';const p={id:'x'};const read=stableReader(()=>({state:'ready',tasks:[{status}]}));
 assert.equal(read(p).tasks[0].status,'pending');status='done';assert.equal(read(p).tasks[0].status,'pending');assert.equal(read(p).tasks[0].status,'done');
});
test('registers a readable project and persists it alongside existing projects',async()=>{
 const base=mkdtempSync(join(tmpdir(),'tmpm-portfolio-'));
 const root=join(base,'project'), tasks=join(root,'.taskmaster','tasks');
 mkdirSync(tasks,{recursive:true});
 writeFileSync(join(tasks,'tasks.json'),JSON.stringify({master:{tasks:[{id:1,title:'First task'}]}}));
 const config=join(base,'config','portfolio.json');
 const app=makeServer([],{config});app.listen(0,'127.0.0.1');await once(app,'listening');
 const origin='http://127.0.0.1:'+app.address().port;
 const add=(project,source=origin)=>fetch(origin+'/api/projects',{
  method:'POST',headers:{Origin:source,'Content-Type':'application/json'},body:JSON.stringify(project)
 });
 try{
  const project={name:'Café',root,tag:'master'};
  assert.equal((await add(project,'https://outside.example')).status,403);
  assert.equal((await add({...project,tag:'missing'})).status,400);
  const response=await add(project);
  assert.equal(response.status,201);
  const {id}=await response.json();
  assert.equal((await add({...project,name:'Duplicate'})).status,409);
  const snapshot=await (await fetch(origin+'/api/portfolio')).json();
  assert.equal(snapshot.projects[0].id,id);
  assert.equal(snapshot.projects[0].tasks[0].title,'First task');
  assert.equal(snapshot.projects[0].root,undefined);
  const saved=JSON.parse(readFileSync(config,'utf8'));
  assert.equal(saved.projects.length,1);
  assert.equal(saved.projects[0].name,'Café');
  assert.equal(saved.projects[0].id,id);
 }finally{app.close();await once(app,'close');rmSync(base,{recursive:true,force:true});}
});
test('serves a scoped local snapshot and refuses write, cross-origin and unlisted paths',async()=>{
 const app=makeServer([{id:'x',name:'Visible',root:'not-in-payload',tag:'master'}]);app.listen(0,'127.0.0.1');await once(app,'listening');
 try{
  const call=(path,headers={},method='GET')=>new Promise((resolve,reject)=>{
    const q=request({host:'127.0.0.1',port:app.address().port,path,headers,method},res=>{let body='';res.on('data',x=>body+=x);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});q.on('error',reject);q.end();
  });
  const out=await call('/api/portfolio');assert.equal(out.status,200);assert.match(out.headers['content-security-policy'],/connect-src 'self'/);assert.match(out.body,/Visible/);assert.doesNotMatch(out.body,/not-in-payload/);
  assert.equal((await call('/api/portfolio',{},'POST')).status,405);
  assert.equal((await call('/api/portfolio',{origin:'https://outside.example'})).status,403);
  assert.equal((await call('/api/portfolio',{host:'outside.example'})).status,403);
  assert.equal((await call('/README.md')).status,404);
  assert.equal((await call('/%2e%2e/package.json')).status,404);
 }finally{app.close();await once(app,'close');}
});
