import { Env,HttpError,json,fail,staff,database,sameOrigin,readJson,rateLimit,clientKey,isLocal,equal,sha } from './platform';
import { submitInquiry,inquiryDetail,updateInquiry } from './inquiries';
import { uploadAsset,updateAsset,attach,imageResponse,targetOptions } from './assets';
import { adminClient } from './admin';
export async function backend(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname;
 try{
 if(path==='/api/admin/login'&&request.method==='POST'){
  sameOrigin(request);if(!isLocal(request)||env.ENVIRONMENT!=='staging'||!env.LOCAL_ADMIN_TOKEN)fail(404,'Not found.');
  await rateLimit(database(env),'login:'+await clientKey(request,env),5);
  const body=await readJson(request);if(typeof body.token!=='string'||!await equal(body.token,env.LOCAL_ADMIN_TOKEN!))fail(401,'Invalid staging token.');
  const response=json({authenticated:true});response.headers.set('Set-Cookie',`misa_local=${await sha(env.LOCAL_ADMIN_TOKEN!)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);return response;
 }
 if(path==='/api/inquiries'&&request.method==='POST')return await submitInquiry(request,env);
 let match=path.match(/^\/api\/inquiries\/(MISA-[a-f0-9-]{36})$/);
 if(match&&request.method==='GET')return await inquiryDetail(request,env,match[1]);
 match=path.match(/^\/api\/inquiries\/(MISA-[a-f0-9-]{36})\/attachments$/);
 if(match&&request.method==='POST')return await attach(request,env,match[1]);
 if(path==='/admin.js'&&request.method==='GET')return new Response(adminClient,{headers:{'Content-Type':'application/javascript','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(path.startsWith('/api/admin/')){
  await staff(request,env);const db=database(env);
  if(request.method==='GET'&&path==='/api/admin/inquiries'){
   const type=url.searchParams.get('type')||'',ref=url.searchParams.get('reference')||'',offset=Number(url.searchParams.get('offset')||0);
   if(ref.length>100||!Number.isInteger(offset)||offset<0||offset>100000)fail(422,'Invalid search.');
   const rows=await db.prepare('SELECT reference,type,status,notification_status,created_at FROM inquiries WHERE (?=\'\' OR type=?) AND (?=\'\' OR reference=?) ORDER BY created_at DESC,reference DESC LIMIT 50 OFFSET ?').bind(type,type,ref,ref,offset).all();return json({results:rows.results});
  }
  if(request.method==='GET'&&path==='/api/admin/assets'){
   const offset=Number(url.searchParams.get('offset')||0);if(!Number.isInteger(offset)||offset<0||offset>100000)fail(422,'Invalid offset.');
   const rows=await db.prepare('SELECT a.*, (SELECT group_concat(target) FROM asset_usage WHERE asset_id=a.id) AS usage FROM assets a ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET ?').bind(offset).all();return json({results:rows.results.map(r=>({...r,targets:targetOptions}))});
  }
  if(path==='/api/admin/assets'&&request.method==='POST')return await uploadAsset(request,env);
  match=path.match(/^\/api\/admin\/assets\/([a-f0-9-]{36})$/);if(match&&request.method==='PATCH')return await updateAsset(request,env,match[1]);
  match=path.match(/^\/api\/admin\/assets\/([a-f0-9-]{36})\/(preview|original)$/);
  if(match&&request.method==='GET'){
   const row=await db.prepare('SELECT original_key FROM assets WHERE id=?').bind(match[1]).first<{original_key:string}>();if(!row)fail(404,'Asset not found.');
   const variant=await db.prepare('SELECT object_key FROM asset_variants WHERE asset_id=? ORDER BY width LIMIT 1').bind(match[1]).first<{object_key:string}>();
   return await imageResponse(env,match[2]==='original'?row!.original_key:variant?.object_key||row!.original_key,match[2]==='original')||fail(404,'Image not found.');
  }
  match=path.match(/^\/api\/admin\/inquiries\/(MISA-[a-f0-9-]{36})$/);if(match&&request.method==='PATCH')return await updateInquiry(request,env,match[1]);
  match=path.match(/^\/api\/admin\/attachments\/([a-f0-9-]{36})$/);if(match&&request.method==='GET'){
   const row=await db.prepare('SELECT object_key FROM attachments WHERE id=?').bind(match[1]).first<{object_key:string}>();if(!row)fail(404,'Attachment not found.');return await imageResponse(env,row!.object_key,true)||fail(404,'Attachment not found.');
  }
  return json({error:'Unknown staff endpoint or method.'},404);
 }
 if(path.startsWith('/api/'))return json({error:'Unknown API endpoint or method.'},404);
 return null;
 }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status);return json({error:'The service is temporarily unavailable. Retry with the same submission key; do not assume your request was saved.'},503);}
}
