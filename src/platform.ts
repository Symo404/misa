import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
export interface Env {
 INQUIRY_ENCRYPTION_KEY?:string; DB?: D1Database; STORAGE?: R2Bucket; NOTIFICATIONS?: Queue<{reference:string}>;
 ENVIRONMENT?:string; INQUIRIES_ENABLED?:string; LOCAL_ADMIN_TOKEN?:string;
 ACCESS_TEAM_DOMAIN?:string; ACCESS_AUD?:string; STAFF_EMAILS?:string; STAFF_SERVICE_SUBJECTS?:string;
 TURNSTILE_SITE_KEY?:string; TURNSTILE_SECRET?:string; TURNSTILE_HOSTNAME?:string;
 RATE_LIMIT_SECRET?:string; EMAIL_PROVIDER?:string; EMAIL_API_KEY?:string; EMAIL_FROM?:string; EMAIL_TO?:string;
}
export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
export const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export const fail=(status:number,message:string):never=>{throw new HttpError(status,message);};
export const sha=async(value:string|ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))).map(b=>b.toString(16).padStart(2,'0')).join('');
export function database(env:Env){return env.DB||fail(503,'Database is not configured. No request was saved.');}
export function storage(env:Env){return env.STORAGE||fail(503,'Private storage is not configured.');}
export const isLocal=(request:Request)=>['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname);
export async function equal(a:string,b:string){return await sha(a)===await sha(b);}
const jwks=new Map<string,ReturnType<typeof createRemoteJWKSet>>();
export async function staff(request:Request,env:Env):Promise<string>{
 if(isLocal(request)&&env.ENVIRONMENT==='staging'&&env.LOCAL_ADMIN_TOKEN){
  const cookie=request.headers.get('Cookie')?.match(/(?:^|;\s*)misa_local=([a-f0-9]+)/)?.[1];
  if(cookie&&await equal(cookie,await sha(env.LOCAL_ADMIN_TOKEN)))return 'local-staging';
 }
 if(!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD||(!env.STAFF_EMAILS&&!env.STAFF_SERVICE_SUBJECTS))fail(503,'Staff access is not configured.');
 const team=env.ACCESS_TEAM_DOMAIN!;
 if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team))fail(503,'Staff access configuration is invalid.');
 const token=request.headers.get('Cf-Access-Jwt-Assertion');if(!token)fail(401,'Cloudflare Access sign-in required.');
 try{
  if(!jwks.has(team))jwks.set(team,createRemoteJWKSet(new URL(`https://${team}/cdn-cgi/access/certs`)));
  return await verifyStaffToken(token!,jwks.get(team)!,env);
 }catch(e){if(e instanceof HttpError)throw e;return fail(401,'Invalid or expired staff authentication.');}
}
export function sameOrigin(request:Request){if(request.headers.get('Origin')!==new URL(request.url).origin)fail(403,'Same-origin request required.');}
export async function readBytes(request:Request,max:number){
 const reader=request.body?.getReader();if(!reader)fail(400,'Request body required.');
 const chunks:Uint8Array[]=[];let total=0;
 while(true){const {value,done}=await reader!.read();if(done)break;total+=value.length;if(total>max){await reader!.cancel();fail(413,'Request is too large.');}chunks.push(value);}
 const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes;
}
export async function readJson(request:Request,max=16384):Promise<Record<string,unknown>>{
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))fail(415,'JSON required.');
 try{const data=JSON.parse(new TextDecoder().decode(await readBytes(request,max)));if(!data||Array.isArray(data)||typeof data!=='object')fail(400,'Object required.');return data;}catch(e){if(e instanceof HttpError)throw e;return fail(400,'Invalid JSON.');}
}
export async function rateLimit(db:D1Database,key:string,limit:number,window=600){
 const now=Math.floor(Date.now()/1000),bucket=Math.floor(now/window);
 const row=await db.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(`${key}:${bucket}`,now+window*2).first<{count:number}>();
 if(!row||row.count>limit)fail(429,'Too many requests. Please try again later.');
}
export async function clientKey(request:Request,env:Env){
 if(!env.RATE_LIMIT_SECRET&&!isLocal(request))fail(503,'Abuse protection is not configured.');
 return sha(`${env.RATE_LIMIT_SECRET||'isolated-local'}:${request.headers.get('CF-Connecting-IP')||'local'}`);
}

export function authorizedIdentity(payload:{email?:unknown;sub?:string},env:Env){
 const email=typeof payload.email==='string'?payload.email.toLowerCase():'';
 if(email&&(env.STAFF_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).includes(email))return email;
 if(payload.sub&&(env.STAFF_SERVICE_SUBJECTS||'').split(',').map(x=>x.trim()).filter(Boolean).includes(payload.sub))return 'service:'+payload.sub;
 return fail(403,'Staff permission required.');
}

export async function verifyStaffToken(token:string,resolveKey:JWTVerifyGetKey,env:Env){
 const {payload}=await jwtVerify(token,resolveKey,{issuer:`https://${env.ACCESS_TEAM_DOMAIN}`,audience:env.ACCESS_AUD,algorithms:['RS256'],requiredClaims:['exp','iat','sub']});
 return authorizedIdentity(payload,env);
}
