import { Env, database, fail, json, readJson, sameOrigin, sha, rateLimit, clientKey, isLocal, staff } from './platform';
export const inquiryTypes=['gift','custom-gift','cheese-box','custom-box','event','general'];
export const statuses=['New','Reviewing','Quoted','Confirmed','Completed','Cancelled'];
const fields=['name','company','email','phone','selected','productReference','quantity','customization','occasion','guests','dietary','allergies','delivery','eventType','location','setup','date','notes','source'];
export function validateInquiry(data:Record<string,unknown>){
 if(!inquiryTypes.includes(String(data.type)))fail(422,'Choose a valid inquiry type.');
 if(data.website)fail(422,'Unable to accept this request.');
 if(data.consent!==true)fail(422,'Privacy acknowledgement is required.');
 const value:Record<string,string|number>={type:String(data.type)};
 for(const key of fields){
  const raw=data[key];if(raw===undefined||raw==='')continue;
  if(key==='quantity'||key==='guests'){const number=Number(raw);if(!Number.isInteger(number)||number<1||number>100000)fail(422,`Invalid ${key}.`);value[key]=number;continue;}
  if(typeof raw!=='string'||raw.length>(key==='notes'?5000:500)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(raw))fail(422,`Invalid ${key}.`);
  value[key]=(raw as string).trim();
 }
 if(typeof value.name!=='string'||value.name.length<2)fail(422,'Full name is required.');
 if(typeof value.email!=='string'||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)||value.email.length>254)fail(422,'A valid email is required.');
 if(['gift','custom-gift'].includes(String(data.type))&&!value.quantity)fail(422,'Quantity is required.');
 if(['cheese-box','custom-box','event'].includes(String(data.type))&&!value.guests)fail(422,'Number of guests is required.');
 if(data.type==='event'&&(!value.date||!value.location))fail(422,'Event date and location are required.');
 if(value.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(String(value.date))||(!Number.isFinite(Date.parse(String(value.date)))||new Date(String(value.date)).toISOString().slice(0,10)!==value.date)))fail(422,'Invalid date.');
 if(value.source&&!String(value.source).startsWith('/'))fail(422,'Invalid source page.');
 return value;
}
async function key(env:Env){
 if(!env.INQUIRY_ENCRYPTION_KEY||! /^[a-f0-9]{64}$/i.test(env.INQUIRY_ENCRYPTION_KEY))fail(503,'Secure inquiry storage is not configured.');
 const bytes=Uint8Array.from(env.INQUIRY_ENCRYPTION_KEY!.match(/../g)!,x=>parseInt(x,16));
 return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);
}
export async function encrypt(value:unknown,env:Env){const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),new TextEncoder().encode(JSON.stringify(value))));return btoa(String.fromCharCode(...iv,...cipher));}
export async function decrypt(value:string,env:Env){const bytes=Uint8Array.from(atob(value),x=>x.charCodeAt(0));return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},await key(env),bytes.slice(12))));}
export async function receipt(reference:string,env:Env){await key(env);const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.INQUIRY_ENCRYPTION_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode('receipt:'+reference)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function turnstile(request:Request,env:Env,token:unknown,verifyFetch:typeof fetch=fetch){
 if(isLocal(request)&&env.ENVIRONMENT==='staging'&&!env.TURNSTILE_SECRET)return;
 if(!env.TURNSTILE_SECRET||!env.TURNSTILE_HOSTNAME)fail(503,'Spam protection is not configured.');
 if(typeof token!=='string'||token.length>2048||!token)fail(422,'Please complete the security check.');
 const response=await verifyFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:token,remoteip:request.headers.get('CF-Connecting-IP'),idempotency_key:crypto.randomUUID()}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)fail(503,'Security check unavailable. Please retry.');
 const result=await response.json() as {success:boolean;hostname:string;action:string};
 if(!result.success||result.hostname!==env.TURNSTILE_HOSTNAME||result.action!=='inquiry')fail(422,'Security check failed. Please retry.');
}
export async function submitInquiry(request:Request,env:Env){
 sameOrigin(request);const db=database(env);
 if(env.INQUIRIES_ENABLED!=='true')fail(503,'Inquiries are not enabled. No request was saved.');
 const id=request.headers.get('Idempotency-Key');if(!id||! /^[a-zA-Z0-9-]{20,100}$/.test(id))fail(400,'A valid idempotency key is required.');
 const data=await readJson(request);const value=validateInquiry(data);
 const idHash=await sha(id!),requestHash=await sha(JSON.stringify(value));
 const existing=await db.prepare('SELECT reference,request_hash,notification_status FROM inquiries WHERE idempotency_hash=?').bind(idHash).first<{reference:string;request_hash:string;notification_status:string}>();
 // Limit retries as well as new submissions. Existing submissions do not consume Turnstile again.
 await rateLimit(db,'submit:'+await clientKey(request,env),20);
 if(existing){if(existing.request_hash!==requestHash)fail(409,'This submission key was already used for different details.');return json({reference:existing.reference,persisted:true,notification:existing.notification_status,receipt:await receipt(existing.reference,env)},200);}
 await turnstile(request,env,data.turnstileToken);
 const reference='MISA-'+crypto.randomUUID(),payload=await encrypt(value,env);
 const enabled=emailEnabled(env);
 try{
 await db.batch([
 db.prepare('INSERT INTO inquiries(reference,type,payload,idempotency_hash,request_hash,notification_status) VALUES(?,?,?,?,?,?)').bind(reference,value.type,payload,idHash,requestHash,enabled?'pending':'disabled'),
 db.prepare("INSERT INTO inquiry_history(reference,actor,action) VALUES(?,'customer','Submitted')").bind(reference),
 db.prepare('INSERT INTO notifications(reference,state) VALUES(?,?)').bind(reference,enabled?'pending':'disabled')]);
 }catch(e){
  const duplicate=await db.prepare('SELECT reference,request_hash,notification_status FROM inquiries WHERE idempotency_hash=?').bind(idHash).first<{reference:string;request_hash:string;notification_status:string}>();
  if(!duplicate)throw e;if(duplicate.request_hash!==requestHash)fail(409,'Submission key conflict.');
  return json({reference:duplicate.reference,persisted:true,notification:duplicate.notification_status,receipt:await receipt(duplicate.reference,env)},200);
 }
 if(enabled&&env.NOTIFICATIONS){try{await env.NOTIFICATIONS.send({reference});}catch{/* Durable outbox is retried by scheduled handler. */}}
 return json({reference,persisted:true,notification:enabled?'pending':'disabled',receipt:await receipt(reference,env)},201);
}
export function emailEnabled(env:Env){return env.EMAIL_PROVIDER==='resend'&&!!env.EMAIL_API_KEY&&!!env.EMAIL_FROM&&!!env.EMAIL_TO;}
export async function inquiryDetail(request:Request,env:Env,reference:string){
 await staff(request,env);const db=database(env);const row=await db.prepare('SELECT reference,type,payload,status,notification_status,created_at FROM inquiries WHERE reference=?').bind(reference).first<{payload:string}>();if(!row)fail(404,'Inquiry not found.');
 const history=await db.prepare('SELECT actor,action,note,created_at FROM inquiry_history WHERE reference=? ORDER BY id').bind(reference).all<{note:string}>();
 const attachments=await db.prepare('SELECT id,filename,mime,size FROM attachments WHERE reference=?').bind(reference).all();
 const attempts=await db.prepare('SELECT attempt,result,created_at FROM notification_attempts WHERE reference=? ORDER BY id').bind(reference).all();
 return json({...row,payload:await decrypt(row!.payload,env),history:await Promise.all(history.results.map(async h=>({...h,note:h.note?await decrypt(h.note,env):''}))),attachments:attachments.results,deliveryAttempts:attempts.results});
}
export async function updateInquiry(request:Request,env:Env,reference:string){
 sameOrigin(request);const actor=await staff(request,env),db=database(env),data=await readJson(request);
 if(!statuses.includes(String(data.status)))fail(422,'Invalid inquiry status.');
 if(data.note!==undefined&&(typeof data.note!=='string'||data.note.length>5000))fail(422,'Invalid internal note.');
 const found=await db.prepare('SELECT reference FROM inquiries WHERE reference=?').bind(reference).first();if(!found)fail(404,'Inquiry not found.');
 await db.batch([db.prepare('UPDATE inquiries SET status=? WHERE reference=?').bind(data.status,reference),db.prepare('INSERT INTO inquiry_history(reference,actor,action,note) VALUES(?,?,?,?)').bind(reference,actor,'Status: '+data.status,data.note?await encrypt(data.note,env):'')]);return json({updated:true});
}
