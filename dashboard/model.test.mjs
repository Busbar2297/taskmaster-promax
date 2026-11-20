import test from 'node:test';import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';import { join } from 'node:path';
import { parse, normalizeProjects,readProject,createTracker } from './model.mjs';
const data=tasks=>JSON.stringify({master:{tasks}});
test('handles tags, subtasks, status, and dependencies without exposing text fields',()=>{
 const out=parse(data([{id:1,title:'Contract',status:'done',description:'SECRET'},{id:2,title:'Build',dependencies:[1,3],status:'weird',subtasks:[{id:1,title:'Read',status:'done'},{id:2,title:'Verify',dependencies:[1]}]}]));
 assert.deepEqual(out[1].blockers,['3']); assert.deepEqual(out[1].subtasks[1].blockers,[]); assert.equal(out[1].status,'unknown'); assert.equal(out[0].description,undefined);
 assert.throws(()=>parse('{"master":{"tasks":0}}')); assert.equal(parse('{"next":{"tasks":[]}}','next').length,0);
});
test('allowlist rejects relative and network roots and duplicate ids',()=>{
 for(const root of ['../x','//example/share']) assert.throws(()=>normalizeProjects({projects:[{id:'x',name:'X',root}]}));
 const p={id:'x',name:'X',root:tmpdir()}; assert.throws(()=>normalizeProjects({projects:[p,p]}));
});
test('read errors isolate projects and preserve last known state; no actor inferred',()=>{
 let fail=false, status='pending';const tracker=createTracker([{id:'a',name:'A'},{id:'b',name:'B'}],p=>p.id==='a'&&fail?{state:'unavailable'}:{state:'ready',tasks:[{id:'t',title:'T',status,subtasks:[]}]});
 assert.equal(tracker.sample().activity.length,0); fail=true; status='done';
 const sample=tracker.sample(); assert.equal(sample.projects[0].state,'stale');assert.equal(sample.projects[0].tasks[0].status,'pending');assert.equal(sample.projects[1].tasks[0].status,'done');assert.equal(sample.activity[0].actor,null);
});
test('real path does not disclose unexpected JSON even when target escapes through a link',()=>{
 const base=mkdtempSync(join(tmpdir(),'tmpm-test-'));
 try{
  const root=join(base,'allowed'), outside=join(base,'outside');mkdirSync(join(root,'.taskmaster'),{recursive:true});mkdirSync(outside);
  writeFileSync(join(outside,'tasks.json'),data([{id:1,title:'Outside'}]));
  symlinkSync(outside,join(root,'.taskmaster','tasks'),'junction');
  assert.equal(readProject({root,tag:'master'}).state,'unavailable');
 }finally{rmSync(base,{recursive:true,force:true});}
});
