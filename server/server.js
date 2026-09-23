import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 10000);
const NODE_TOKEN = String(process.env.NODE_TOKEN || "").trim();
const HEARTBEAT_TIMEOUT_MS = 90_000;
const nodes = new Map();
const tasks = [];
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function serveFile(res, filePath, contentType) {
  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, { ...headers, "content-type": contentType });
    res.end(data);
    return true;
  } catch { return false; }
}

const headers = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,x-node-token",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS"
};
function json(res, status, data) { res.writeHead(status, headers); res.end(JSON.stringify(data)); }
async function readBody(req) { let body=""; for await (const chunk of req) body+=chunk; if(!body)return {}; try{return JSON.parse(body)}catch{return null} }
function authorized(req) { return Boolean(NODE_TOKEN) && req.headers["x-node-token"] === NODE_TOKEN; }
function publicNode(node) { return node ? {...node} : null; }
function refreshStatuses(){const now=Date.now();for(const node of nodes.values())node.status=now-node.lastSeen<=HEARTBEAT_TIMEOUT_MS?"online":"offline";}
function nodeFromBody(body){const now=Date.now();return{id:String(body.nodeId||crypto.randomUUID()),name:String(body.name||"Android Node").slice(0,80),platform:String(body.platform||"android").slice(0,80),deviceModel:body.deviceModel?String(body.deviceModel).slice(0,120):undefined,androidVersion:body.androidVersion?String(body.androidVersion).slice(0,40):undefined,appVersion:body.appVersion?String(body.appVersion).slice(0,40):undefined,battery:Number.isFinite(Number(body.battery))?Math.max(0,Math.min(100,Number(body.battery))):null,status:"online",lastSeen:now,registeredAt:now,ip:undefined};}

const server=http.createServer(async(req,res)=>{
  if(req.method==="OPTIONS")return json(res,204,{ok:true});
  const url=new URL(req.url||"/","http://localhost"); refreshStatuses();
  if(url.pathname==="/"&&req.method==="GET"){if(await serveFile(res,path.join(ROOT_DIR,"index.html"),"text/html; charset=utf-8"))return;return json(res,404,{ok:false,error:"Dashboard not found"});}
  if(url.pathname==="/node-agent/agent.html"&&req.method==="GET"){if(await serveFile(res,path.join(ROOT_DIR,"node-agent","agent.html"),"text/html; charset=utf-8"))return;return json(res,404,{ok:false,error:"Node Agent not found"});}
  if(url.pathname==="/health"&&req.method==="GET")return json(res,200,{ok:true,service:"FreeCloudFarm Node API",time:new Date().toISOString(),nodes:nodes.size,online:[...nodes.values()].filter(n=>n.status==="online").length});
  if(url.pathname==="/api/nodes"&&req.method==="GET")return json(res,200,{ok:true,nodes:[...nodes.values()].map(publicNode)});
  if(!authorized(req))return json(res,401,{ok:false,error:"Unauthorized. Check NODE_TOKEN."});

  if(url.pathname==="/api/node/register"&&req.method==="POST"){
    const body=await readBody(req);if(!body)return json(res,400,{ok:false,error:"Invalid JSON body"});
    const id=String(body.nodeId||"").trim();if(!id)return json(res,400,{ok:false,error:"nodeId is required"});
    const existing=nodes.get(id),now=Date.now();const node=existing||nodeFromBody({...body,nodeId:id});
    node.name=String(body.name||node.name||"Android Node").slice(0,80);node.platform=String(body.platform||node.platform||"android").slice(0,80);
    if(body.deviceModel)node.deviceModel=String(body.deviceModel).slice(0,120);if(body.androidVersion)node.androidVersion=String(body.androidVersion).slice(0,40);if(body.appVersion)node.appVersion=String(body.appVersion).slice(0,40);
    if(body.battery!==undefined&&Number.isFinite(Number(body.battery)))node.battery=Math.max(0,Math.min(100,Number(body.battery)));
    node.status="online";node.lastSeen=now;if(!node.registeredAt)node.registeredAt=now;nodes.set(id,node);
    return json(res,existing?200:201,{ok:true,registered:!existing,node:publicNode(node)});
  }
  if(url.pathname==="/api/node/heartbeat"&&req.method==="POST"){
    const body=await readBody(req);if(!body)return json(res,400,{ok:false,error:"Invalid JSON body"});const id=String(body.nodeId||"").trim();const node=nodes.get(id);if(!node)return json(res,404,{ok:false,error:"Node not registered"});
    node.status="online";node.lastSeen=Date.now();if(body.name)node.name=String(body.name).slice(0,80);if(body.deviceModel)node.deviceModel=String(body.deviceModel).slice(0,120);if(body.androidVersion)node.androidVersion=String(body.androidVersion).slice(0,40);if(body.appVersion)node.appVersion=String(body.appVersion).slice(0,40);if(body.battery!==undefined&&Number.isFinite(Number(body.battery)))node.battery=Math.max(0,Math.min(100,Number(body.battery)));
    return json(res,200,{ok:true,node:publicNode(node)});
  }
  if(url.pathname==="/api/node/offline"&&req.method==="POST"){const body=await readBody(req);const id=String(body?.nodeId||"").trim();const node=nodes.get(id);if(!node)return json(res,404,{ok:false,error:"Node not registered"});node.status="offline";node.lastSeen=Date.now();return json(res,200,{ok:true,node:publicNode(node)});}
  if(url.pathname==="/api/nodes"&&req.method==="DELETE"){const id=String(url.searchParams.get("nodeId")||"").trim();if(!id)return json(res,400,{ok:false,error:"nodeId is required"});if(!nodes.has(id))return json(res,404,{ok:false,error:"Node not found"});nodes.delete(id);return json(res,200,{ok:true,deleted:id});}

  if(url.pathname==="/api/tasks"&&req.method==="GET"){
    const nodeId=url.searchParams.get("nodeId");return json(res,200,{ok:true,tasks:tasks.filter(t=>(!nodeId||!t.nodeId||t.nodeId===nodeId)&&t.status==="queued").slice(-20).reverse()});
  }
  if(url.pathname==="/api/tasks"&&req.method==="POST"){
    const body=await readBody(req);if(!body)return json(res,400,{ok:false,error:"Invalid JSON body"});
    const task={id:crypto.randomUUID(),nodeId:body.nodeId?String(body.nodeId):null,action:String(body.action||"noop").slice(0,120),target:body.target?String(body.target).slice(0,2000):null,status:"queued",createdAt:new Date().toISOString(),result:null};tasks.push(task);return json(res,201,{ok:true,task});
  }
  const taskMatch=url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if(taskMatch&&req.method==="POST"){
    const task=tasks.find(t=>t.id===decodeURIComponent(taskMatch[1]));if(!task)return json(res,404,{ok:false,error:"Task not found"});const body=await readBody(req);if(!body)return json(res,400,{ok:false,error:"Invalid JSON body"});
    if(body.status)task.status=String(body.status).slice(0,40);if(body.result!==undefined)task.result=body.result;task.updatedAt=new Date().toISOString();return json(res,200,{ok:true,task});
  }
  return json(res,404,{ok:false,error:"Not found"});
});
server.listen(PORT,()=>console.log("FreeCloudFarm API listening on "+PORT));
