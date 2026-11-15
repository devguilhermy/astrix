import { realpath, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { PROTOCOL_VERSION } from '@astrix/session';
import { Room } from './room';
import { HostClock } from './clock';
import { lanInterfaces, selectInterface, isAllowedPeer } from './interfaces';
import { requestBoundary, readJson, RateLimit, MAX_FRAME_BYTES, MAX_WS_FRAME_BYTES, MAX_BUFFER_BYTES } from './security/rateLimit';
import { verifyBuild } from './manifest';
import { publicHeaders, serveStatic } from './static';
interface SocketData {deviceId:string}
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:publicHeaders});
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export async function startHost(args=process.argv.slice(2)) {
  const {values}=parseArgs({args,options:{bind:{type:'string'},port:{type:'string'},'control-port':{type:'string'}},strict:true});
  const port=Number(values.port??3000),controlPort=Number(values['control-port']??(port+1));
  if(!Number.isInteger(port)||port<1024||port>65535||!Number.isInteger(controlPort)||controlPort<1024||controlPort>65535||port===controlPort)throw new Error('Use distinct integer --port / --control-port values between 1024 and 65535 (the control port defaults to --port + 1, so pass --control-port with --port 65535).');
  const root=resolve(import.meta.dir,'../../web/dist');
  try {if(!(await stat(resolve(root,'index.html'))).isFile())throw new Error();}catch{throw new Error('Production assets missing: prepare online with `bun install && bun run build`, then run `bun run host`. No development server or dependency download was started.');}
  const dist=await realpath(root);await verifyBuild(dist);
  const selected=selectInterface(lanInterfaces(),values.bind),host=`${selected.address}:${port}`,origin=`http://${host}`;
  const index=await Bun.file(resolve(dist,'index.html')).text(),moduleTag=index.match(/<script\b(?=[^>]*\btype=["']module["'])[^>]*>/i)?.[0],source=moduleTag?.match(/\bsrc=["']([^"']+)["']/i)?.[1];
  if(!source)throw new Error('Production module entry missing: rebuild with `bun run build` before hosting.');
  const buildId=new URL(source,origin).pathname;
  const room=new Room(buildId),ipLimits=new RateLimit(120,10000),joinLimits=new RateLimit(20,60000),ticketLimits=new RateLimit(30,60000);
  const server=Bun.serve<SocketData>({hostname:selected.address,port,maxRequestBodySize:MAX_FRAME_BYTES,
    async fetch(request,server){
      const url=new URL(request.url),api=url.pathname.startsWith('/api/'),upgrade=url.pathname==='/ws';
      if(!requestBoundary(request,host,api||upgrade))return json({code:'UNAUTHORIZED'},403);
      const peer=server.requestIP(request)?.address;
      if(!peer||!isAllowedPeer(peer,selected))return json({code:'UNAUTHORIZED'},403);
      if((api||upgrade)&&!ipLimits.consume(peer))return json({code:'RATE_LIMITED'},429);
      if(url.pathname==='/health'&&request.method==='GET')return json({protocol:PROTOCOL_VERSION,buildId});
      if(upgrade){
        if(request.method!=='GET'||url.searchParams.get('buildId')!==buildId)return json({code:'VERSION_MISMATCH'},426);
        const deviceId=room.consumeTicket(url.searchParams.get('ticket')??'',buildId);if(!deviceId)return json({code:'UNAUTHORIZED'},401);
        if(server.upgrade(request,{data:{deviceId}}))return;return json({code:'BAD_MESSAGE'},400);
      }
      if(api){
        if(request.method!=='POST')return json({code:'BAD_MESSAGE'},405);
        try{
          const body=await readJson(request);if(!object(body))return json({code:'BAD_MESSAGE'},400);
          const credential=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';
          if(url.pathname==='/api/host'){if(Object.keys(body).join(',')!=='capability'||typeof body.capability!=='string')throw new Error('BAD_MESSAGE');return json({credential:room.hostCredential(body.capability)});}
          if(url.pathname==='/api/join'){
            if(!joinLimits.consume(peer))return json({code:'RATE_LIMITED'},429);
            if(Object.keys(body).sort().join(',')!=='buildId,name,protocol,roomId,token'||body.protocol!==PROTOCOL_VERSION||body.buildId!==buildId)return json({code:'VERSION_MISMATCH'},426);
            if(typeof body.token!=='string'||typeof body.roomId!=='string'||typeof body.name!=='string')throw new Error('BAD_MESSAGE');
            return json(room.join(body.token,body.roomId,body.name));
          }
          if(url.pathname==='/api/pair'&&Object.keys(body).length===0)return json(room.pairing(credential));
          if(url.pathname==='/api/lobby'&&Object.keys(body).length===0)return json(room.lobby(credential));
          if(url.pathname==='/api/ticket'&&Object.keys(body).join(',')==='buildId'&&typeof body.buildId==='string'){
            // Authenticate first: only real devices occupy limiter slots, so garbage bearers cannot fill it.
            const device=room.authenticate(credential);
            if(!ticketLimits.consume(device.id))return json({code:'RATE_LIMITED'},429);
            return json({ticket:room.mintTicket(credential,body.buildId),roomId:room.id});
          }
          if(url.pathname==='/api/admin'&&Object.keys(body).join(',')==='action'&&['lock','unlock','host-only','solo','team'].includes(String(body.action))){room.admin(credential,body.action as 'lock'|'unlock'|'host-only'|'solo'|'team');return json({ok:true});}
          return json({code:'BAD_MESSAGE'},400);
        }catch(error){const code=error instanceof Error?error.message:'BAD_MESSAGE';const status=code==='UNAUTHORIZED'?401:code==='HOST_ONLY'?403:code==='ROOM_FULL'||code==='JOIN_LOCKED'?409:code==='VERSION_MISMATCH'?426:code==='RATE_LIMITED'?429:400;return json({code:status===400?'BAD_MESSAGE':code},status);}
      }
      if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:publicHeaders});
      return serveStatic(dist,url.pathname);
    },
    websocket:{maxPayloadLength:MAX_WS_FRAME_BYTES,backpressureLimit:MAX_BUFFER_BYTES,closeOnBackpressureLimit:false,idleTimeout:40,open(ws){room.attach(ws.data.deviceId,ws);},message(ws,message){room.receive(ws.data.deviceId,ws,message);},close(ws){room.detach(ws.data.deviceId,ws);},drain(ws){room.drain(ws.data.deviceId,ws);}},
  });
  const controlHost=`127.0.0.1:${controlPort}`,controlHosts=[controlHost,`localhost:${controlPort}`];
  const control=(()=>{
    try{return Bun.serve({hostname:'127.0.0.1',port:controlPort,fetch(request){
      if(!requestBoundary(request,controlHosts,false)||request.headers.get('origin')!==null||request.method!=='GET'||new URL(request.url).pathname!=='/')return new Response('Forbidden',{status:403,headers:publicHeaders});
      return new Response(null,{status:303,headers:{...publicHeaders,Location:`${origin}/host#host=${room.hostCapability}`}});
    }});}catch(error){server.stop(true);throw new Error(`Cannot bind loopback host control on ${controlHost}; choose a free --control-port.`,{cause:error});}
  })();
  const clock=new HostClock(seconds=>room.tick(seconds),()=>room.stall());const interval=setInterval(()=>{clock.pulse();room.maintenance();},100);
  console.log(`ASTRIX trusted-LAN room\nInterface: ${selected.name}\nLAN: ${origin}\nOpen host control locally: http://${controlHost}/\nHTTP is plaintext. Use an isolated trusted LAN; never port-forward. Stopping Bun ends this in-memory room.`);
  const stop=()=>{clearInterval(interval);room.close();server.stop();control.stop(true);};process.once('SIGINT',stop);process.once('SIGTERM',stop);return {server,control,room,stop};
}
if(import.meta.main)startHost().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
