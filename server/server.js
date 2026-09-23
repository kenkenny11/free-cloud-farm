import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT=Number(process.env.PORT||10000),NODE_TOKEN=String(process.env.NODE_TOKEN||"").trim(),HEARTBEAT_TIMEOUT_MS=90000;
const nodes=new Map(),tasks=[];const ROOT_DIR=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const headers={"content-type":"application/json; charset=utf-8","access-control-allow-origin":"*","access-control-allow-headers":"content-type,x-node-token","access-control-allow-methods":"GET,POST,DELETE,OPTIONS"};
async function serveFile(res,filePath,contentType){try{const data=await fs.readFile(filePath);res.writeHead(200,{...headers,"content-type":contentType});res.end(data);return true;}catch{return false;}}
function json(res,status,data){res.writeHead(status,headers);res.end(JSON.stringify(data));}
async function readBody(req){let body="";for await(const chunk of req)body+=chunk;if(!body)return{};try{return JSON.parse(body)}catch{return null}}
function authorized(req){return Boolean(NODE_TOKEN)&&req.headers["x-node-token"]===NODE_TOKEN}
function publicNode(n){return n?{...n}:null}
function refreshStatuses(){const now=Date.now();for(const n of nodes.values())n.status=now-n.lastSeen<=HEARTBEAT_TIMEOUT_MS?"online":"offline"}
function nodeFromBody(b){const now=Date.now();return{id:String(b.nodeId||crypto.randomUUID()),name:String(b.name||"Android Node").slice(0,80),platform:String(b.platform||"android").slice(0,80),deviceModel:b.deviceModel?String(b.deviceModel).slice(0,120):undefined,androidVersion:b.androidVersion?String(b.androidVersion).slice(0,40):undefined,appVersion:b.appVersion?String(b.appVersion).slice(0,40):undefined,battery:Number.isFinite(Number(b.battery))?Math.max(0,Math.min(100,Number(b.battery))):null,status:"online",lastSeen:now,registeredAt:now,ip:undefined}}
const server=http.createServer(async(req,res)=>{
 if(req.method==="OPTIONS")return json(res,204,{ok:true});const url=new URL(req.url||"/","http://localhost");refreshStatuses();
 if(url.pathname==="/"&&req.method==="GET"){if(await serveFile(res,path.join(ROOT_DIR,"index.html"),"text/html; charset=utf-8"))return;return json(res,404,{ok:false,error:"Dashboard not found"})}
 if(url.pathname==="/node-agent/agent.html"&&req.method==="GET"){if(await serveFile(res,path.join(ROOT_DIR,"node-agent","agent.html"),"text/html; charset=utf-8"))return;return json(res,404,{ok:false,error:"Node Agent not found"})}
 if(url.pathname==="/health"&&req.method==="GET")return json(res,200,{ok:true,service:"FreeCloudFarm Node API",time:new Date().toISOString(),nodes:nodes.size,online:[...nodes.values()].filter(n=>n.status==="online").length});
 if(url.pathname==="/api/nodes"&&req.method==="GET")return json(res,200,{ok:true,nodes:[...nodes.values()].map(publicNode)});
 if(!authorized(req))return json(res,401,{ok:false,error:"Unauthorized. Check NODE_TOKEN."});

 if(url.pathname==="/api/node/register"&&req.method==="POST"){const b=await readBody(req);if(!b)return json(res,400,{ok:false,error:"Invalid JSON body"});const id=String(b.nodeId||"").trim();if(!id)return json(res,400,{ok:false,error:"nodeId is required"});const existing=nodes.get(id),now=Date.now(),n=existing||nodeFromBody({...b,nodeId:id});n.name=String(b.name||n.name||"Android Node").slice(0,80);n.platform=String(b.platform||n.platform||"android").slice(0,80);if(b.deviceModel)n.deviceModel=String(b.deviceModel).slice(0,120);if(b.androidVersion)n.androidVersion=String(b.androidVersion).slice(0,40);if(b.appVersion)n.appVersion=String(b.appVersion).slice(0,40);if(b.battery!==undefined&&Number.isFinite(Number(b.battery)))n.battery=Math.max(0,Math.min(100,Number(b.battery)));n.status="online";n.lastSeen=now;if(!n.registeredAt)n.registeredAt=now;nodes.set(id,n);return json(res,existing?200:201,{ok:true,registered:!existing,node:publicNode(n)})}
 if(url.pathname==="/api/node/heartbeat"&&req.method==="POST"){const b=await readBody(req);if(!b)return json(res,400,{ok:false,error:"Invalid JSON body"});const id=String(b.nodeId||"").trim(),n=nodes.get(id);if(!n)return json(res,404,{ok:false,error:"Node not registered"});n.status="online";n.lastSeen=Date.now();if(b.name)n.name=String(b.name).slice(0,80);if(b.deviceModel)n.deviceModel=String(b.deviceModel).slice(0,120);if(b.androidVersion)n.androidVersion=String(b.androidVersion).slice(0,40);if(b.appVersion)n.appVersion=String(b.appVersion).slice(0,40);if(b.battery!==undefined&&Number.isFinite(Number(b.battery)))n.battery=Math.max(0,Math.min(100,Number(b.battery)));return json(res,200,{ok:true,node:publicNode(n)})}
 if(url.pathname==="/api/node/offline"&&req.method==="POST"){const b=await readBody(req),id=String(b?.nodeId||"").trim(),n=nodes.get(id);if(!n)return json(res,404,{ok:false,error:"Node not registered"});n.status="offline";n.lastSeen=Date.now();return json(res,200,{ok:true,node:publicNode(n)})}
 if(url.pathname==="/api/nodes"&&req.method==="DELETE"){const id=String(url.searchParams.get("nodeId")||"").trim();if(!id)return json(res,400,{ok:false,error:"nodeId is required"});if(!nodes.has(id))return json(res,404,{ok:false,error:"Node not found"});nodes.delete(id);return json(res,200,{ok:true,deleted:id})}
 if(url.pathname==="/api/tasks"&&req.method==="GET"){const nodeId=url.searchParams.get("nodeId");return json(res,200,{ok:true,tasks:tasks.filter(t=>!nodeId||!t.nodeId||t.nodeId===nodeId).slice(-50).reverse()})}
 if(url.pathname==="/api/tasks/poll"&&req.method==="GET"){const nodeId=String(url.searchParams.get("nodeId")||"").trim();if(!nodeId)return json(res,400,{ok:false,error:"nodeId is required"});const queued=tasks.filter(t=>(t.status==="queued")&&(!t.nodeId||t.nodeId===nodeId)).slice(0,5);for(const t of queued){t.status="running";t.startedAt=new Date().toISOString();t.claimedBy=nodeId;}return json(res,200,{ok:true,tasks:queued})}
 if(url.pathname==="/api/tasks"&&req.method==="POST"){const b=await readBody(req);if(!b)return json(res,400,{ok:false,error:"Invalid JSON body"});const t={id:crypto.randomUUID(),nodeId:b.nodeId?String(b.nodeId):null,action:String(b.action||"noop").slice(0,120),target:b.target?String(b.target).slice(0,2000):null,status:"queued",createdAt:new Date().toISOString(),result:null};tasks.push(t);return json(res,201,{ok:true,task:t})}
 const m=url.pathname.match(/^\/api\/tasks\/([^/]+)$/);if(m&&req.method==="POST"){const t=tasks.find(x=>x.id===decodeURIComponent(m[1]));if(!t)return json(res,404,{ok:false,error:"Task not found"});const b=await readBody(req);if(!b)return json(res,400,{ok:false,error:"Invalid JSON body"});if(b.status)t.status=String(b.status).slice(0,40);if(b.result!==undefined)t.result=b.result;t.updatedAt=new Date().toISOString();return json(res,200,{ok:true,task:t})}
 return json(res,404,{ok:false,error:"Not found"})
});
server.listen(PORT,()=>console.log("FreeCloudFarm API listening on "+PORT));
