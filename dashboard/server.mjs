import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { normalizeProjects,createTracker,readProject } from './model.mjs';
const publicFiles=new Map([['/',['index.html','text/html']],['/app.mjs',['app.mjs','text/javascript']],['/styles.css',['styles.css','text/css']]]);
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"};
export function stableReader(read=readProject){
 const previous=new Map();
 return project=>{
  const observed=read(project), state=previous.get(project.id);
  if(observed.state!=='ready'){previous.set(project.id,{...state,key:null});return observed;}
  const key=JSON.stringify(observed.tasks);
  if(!state||state.key===key){previous.set(project.id,{key,accepted:observed});return observed;}
  previous.set(project.id,{key,accepted:state.accepted});return state.accepted||observed;
 };
}
export function makeServer(projects,{interval=750}={}){
 const tracker=createTracker(projects,stableReader()); let payload=JSON.stringify(tracker.sample());
 const timer=setInterval(()=>{payload=JSON.stringify(tracker.sample());},interval); timer.unref();
 const server=createServer((req,res)=>{
  const host='127.0.0.1:'+server.address()?.port;
  const reply=(code,body,type='text/plain')=>{res.writeHead(code,{...headers,'Content-Type':type+'; charset=utf-8'});res.end(req.method==='HEAD'?undefined:body);};
  if(req.headers.host!==host|| (req.headers.origin&&req.headers.origin!=='http://'+host) || (req.url==='/api/portfolio'&&['cross-site','same-site'].includes(req.headers['sec-fetch-site']))) return reply(403,'Forbidden');
  if(!['GET','HEAD'].includes(req.method)) return reply(405,'Read only');
  if(req.url==='/api/portfolio') return reply(200,payload,'application/json');
  const file=publicFiles.get(req.url);
  if(!file) return reply(404,'Not found');
  try{return reply(200,readFileSync(new URL(file[0],import.meta.url)),file[1]);}catch{return reply(503,'Dashboard asset unavailable');}
 });
 server.on('close',()=>clearInterval(timer));
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {values}=await import('node:util').then(({parseArgs})=>parseArgs({options:{config:{type:'string'},port:{type:'string'}}}));
 if(!values.config)throw Error('Supply --config with an explicit local project allowlist. See dashboard/README.md.');
 if(/^[\\/]{2}/.test(values.config))throw Error('Use a local config file.');
 let cfg; try {cfg=JSON.parse(readFileSync(values.config,'utf8').replace(/^\uFEFF/,''));}catch{throw Error('Cannot read configuration as local JSON.');}
 const port=Number(values.port||8917); if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('Invalid local port.');
 const app=makeServer(normalizeProjects(cfg));app.listen(port,'127.0.0.1',()=>console.log('TaskMasterProMax: http://127.0.0.1:'+port));
}
