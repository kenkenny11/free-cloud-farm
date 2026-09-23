import http from "node:http";
import crypto from "node:crypto";

const PORT=process.env.PORT||10000;
const NODE_TOKEN=process.env.NODE_TOKEN||"";
const nodes=new Map();
const tasks=[];
const json=(res,status,data)=>{res.writeHead(status,{"content-type":"application/json","access-control-allow-origin":"*","access-control-allow-headers":"content-type,x-node-token","access-control-allow-methods":"GET,POST,OPTIONS"});res.end(JSON.stringify(data))};
const read=async req=>{let b="";for await(const c of req)b+=c;try{return b?JSON.parse(b):{}}catch{return{}}};
const auth=req=>NODE_TOKEN && req.headers["x-node-token"]===NODE_TOKEN;
const server=http.createServer(async(req,res)=>{
 if(req.method==="OPTIONS")return json(res,204,{});
 const u=new URL(req.url,"http://localhost");
 if(u.pathname==="/health")return json(res,200,{ok:true,service:"FreeCloudFarm Node API",time:new Date().toISOString(),nodes:nodes.size});
 if(u.pathname==="/api/nodes"&&req.method==="GET")return json(res,200,{nodes:[...nodes.values()].map(n=>({...n,token:undefined}))});
 if(!auth(req))return json(res,401,{ok:false,error:"Unauthorized"});
 if(u.pathname==="/api/node/register"&&req.method==="POST"){const b=await read(req);const id=b.nodeId||crypto.randomUUID();const n={id,name:b.name||"Android Node",platform:b.platform||"android",status:"online",lastSeen:Date.now()};nodes.set(id,n);return json(res,200,{ok:true,node:n})}
 if(u.pathname==="/api/node/heartbeat"&&req.method==="POST"){const b=await read(req);const n=nodes.get(b.nodeId);if(!n)return json(res,404,{ok:false,error:"Node not registered"});n.status="online";n.lastSeen=Date.now();if(b.battery!==undefined)n.battery=b.battery;if(b.deviceModel)n.deviceModel=b.deviceModel;return json(res,200,{ok:true,node:n})}
 if(u.pathname==="/api/tasks"&&req.method==="GET"){const node=u.searchParams.get("nodeId");return json(res,200,{tasks:tasks.filter(t=>!t.nodeId||t.nodeId===node).slice(0,20)})}
 if(u.pathname==="/api/tasks"&&req.method==="POST"){const b=await read(req);const t={id:crypto.randomUUID(),nodeId:b.nodeId||null,action:b.action||"noop",target:b.target||null,status:"queued",createdAt:new Date().toISOString()};tasks.push(t);return json(res,201,{ok:true,task:t})}
 if(u.pathname.startsWith("/api/tasks/")&&req.method==="POST"){const id=u.pathname.split("/").pop();const t=tasks.find(x=>x.id===id);if(!t)return json(res,404,{ok:false,error:"Task not found"});const b=await read(req);t.status=b.status||t.status;t.result=b.result||t.result;return json(res,200,{ok:true,task:t})}
 return json(res,404,{ok:false,error:"Not found"});
});
server.listen(PORT,()=>console.log("FreeCloudFarm API listening on "+PORT));