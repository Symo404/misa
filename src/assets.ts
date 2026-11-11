import { Env,database,storage,fail,json,readBytes,readJson,staff,sameOrigin,sha,rateLimit,clientKey,equal } from './platform';
import { receipt,turnstile } from './inquiries';
import { worlds,items } from './data.js';
export const targets=[...worlds.map(w=>'world-'+w.slug),...items.map(i=>'item-'+i.id)];
export const targetOptions=[...worlds.map(w=>({value:'world-'+w.slug,label:'World: '+w.name})),...items.map(i=>({value:'item-'+i.id,label:i.id+' · '+i.name}))];
export function dimensions(bytes:Uint8Array){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),text=(start:number,end:number)=>new TextDecoder().decode(bytes.slice(start,end));
 if(bytes.length<30)fail(422,'Invalid image.');
 if(bytes[0]===137&&text(1,4)==='PNG'&&text(12,16)==='IHDR')return {mime:'image/png',width:view.getUint32(16),height:view.getUint32(20)};
 if(text(0,4)==='RIFF'&&text(8,12)==='WEBP'){
  if(text(12,16)==='VP8X')return {mime:'image/webp',width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)};
  if(text(12,16)==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42)return {mime:'image/webp',width:view.getUint16(26,true)&16383,height:view.getUint16(28,true)&16383};
  if(text(12,16)==='VP8L'&&bytes[20]===47)return {mime:'image/webp',width:1+(((bytes[22]&63)<<8)|bytes[21]),height:1+(((bytes[24]&15)<<10)|(bytes[23]<<2)|((bytes[22]&192)>>6))};
 }
 if(bytes[0]===255&&bytes[1]===216){let offset=2;while(offset+9<bytes.length){if(bytes[offset++]!==255)break;const marker=bytes[offset++];if(marker===216||marker===217)continue;const length=view.getUint16(offset);if(length<2||offset+length>bytes.length)break;if([192,193,194].includes(marker))return {mime:'image/jpeg',width:view.getUint16(offset+5),height:view.getUint16(offset+3)};offset+=length;}}
 return fail(422,'Only valid PNG, JPEG and WebP images are accepted.');
}
function inspect(bytes:Uint8Array,min=1,max=20_000_000){const d=dimensions(bytes);if(d.width<min||d.height<min||d.width*d.height>max||d.width>10000||d.height>10000)fail(422,'Image dimensions are outside the allowed range.');return d;}
async function multipart(request:Request,max:number){if(!request.headers.get('Content-Type')?.startsWith('multipart/form-data'))fail(415,'Multipart image upload required.');const bytes=await readBytes(request,max);try{return await new Response(bytes,{headers:{'Content-Type':request.headers.get('Content-Type')!}}).formData();}catch{return fail(400,'Invalid multipart upload.');}}
function file(form:FormData,name:string,max:number){const f=form.get(name);if(!(f instanceof File)||f.size<30||f.size>max)fail(422,`Invalid ${name} file or size.`);return f as File;}
export async function uploadAsset(request:Request,env:Env){
 sameOrigin(request);const actor=await staff(request,env),db=database(env),bucket=storage(env);await rateLimit(db,'asset:'+await sha(actor),30);
 const form=await multipart(request,25*1024*1024),original=file(form,'original',20*1024*1024);
 const alt=String(form.get('alt')||'').trim(),kind=String(form.get('kind')||'');
 if(!alt||alt.length>500||!['ai-concept','verified-photo'].includes(kind))fail(422,'Alt text and image provenance are required.');
 const provenance=String(form.get('provenance')||'').trim();if(provenance.length<5||provenance.length>1000)fail(422,'Describe the approval or verified source.');
 const originalBytes=new Uint8Array(await original.arrayBuffer()),d=inspect(originalBytes,320);
 if(original.type!==d.mime)fail(422,'Image MIME type does not match file content.');
 const variants:{bytes:Uint8Array;width:number;height:number;mime:string}[]=[];
 for(const width of [640,1280]){const f=file(form,'variant'+width,2*1024*1024),bytes=new Uint8Array(await f.arrayBuffer()),v=inspect(bytes);if(v.mime!=='image/webp'||v.width!==Math.min(width,d.width)||Math.abs(v.height/v.width-d.height/d.width)>.02)fail(422,'Invalid optimized variant dimensions.');if(!variants.some(existing=>existing.width===v.width))variants.push({bytes,...v});}
 const id=crypto.randomUUID(),originalKey=`originals/${id}`;
 const keys=[originalKey,...variants.map(v=>`variants/${id}/${v.width}.webp`)];
 try{
 await bucket.put(originalKey,originalBytes,{httpMetadata:{contentType:d.mime}});
 for(const v of variants)await bucket.put(`variants/${id}/${v.width}.webp`,v.bytes,{httpMetadata:{contentType:'image/webp'}});
 await db.batch([
 db.prepare('INSERT INTO assets(id,original_key,mime,size,width,height,alt,kind,created_by,provenance) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,originalKey,d.mime,original.size,d.width,d.height,alt,kind,actor,provenance),
 ...variants.map(v=>db.prepare('INSERT INTO asset_variants(asset_id,width,height,object_key,size) VALUES(?,?,?,?,?)').bind(id,v.width,v.height,`variants/${id}/${v.width}.webp`,v.bytes.length)),
 db.prepare("INSERT INTO asset_history(asset_id,actor,action) VALUES(?,?,'Imported as draft')").bind(id,actor)]);
 }catch(e){await bucket.delete(keys);throw e;}
 return json({id,status:'draft'},201);
}
export async function updateAsset(request:Request,env:Env,id:string){
 sameOrigin(request);const actor=await staff(request,env),db=database(env),data=await readJson(request);
 const row=await db.prepare('SELECT status,alt,focal_x,focal_y,desired_target FROM assets WHERE id=?').bind(id).first<{status:string;alt:string;focal_x:number;focal_y:number;desired_target:string}>();if(!row)fail(404,'Asset not found.');
 const status=String(data.status||row!.status),alt=data.alt===undefined?row!.alt:data.alt,x=data.focalX===undefined?row!.focal_x:Number(data.focalX),y=data.focalY===undefined?row!.focal_y:Number(data.focalY);
 if(!['draft','approved','published'].includes(status)||typeof alt!=='string'||!alt.trim()||alt.length>500||!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>100||y<0||y>100)fail(422,'Invalid asset metadata.');
 if(status==='published'&&!['approved','published'].includes(row!.status))fail(409,'Approve the asset before publishing.');
 if(status==='published'){
 const variants=await db.prepare('SELECT object_key FROM asset_variants WHERE asset_id=?').bind(id).all<{object_key:string}>();
 if(!variants.results.length)fail(409,'Optimized variants are missing.');for(const v of variants.results)if(!await storage(env).head(v.object_key))fail(409,'Optimized variant is unavailable.');
 }
 const target=data.target===undefined?row!.desired_target:String(data.target);if(target&&!targets.includes(target))fail(422,'Unknown image placement.');
 await db.batch([
 db.prepare('UPDATE assets SET status=?,alt=?,focal_x=?,focal_y=?,desired_target=? WHERE id=?').bind(status,String(alt).trim(),x,y,target,id),
 ...(target&&status==='published'?[db.prepare('INSERT INTO asset_usage(target,asset_id) VALUES(?,?) ON CONFLICT(target) DO UPDATE SET asset_id=excluded.asset_id').bind(target,id)]:[]),
 db.prepare('INSERT INTO asset_history(asset_id,actor,action) VALUES(?,?,?)').bind(id,actor,`Metadata/status ${status}${target?' assigned '+target:''}`)]);
 return json({updated:true});
}
export async function imageResponse(env:Env,key:string,privateImage=false){const object=await storage(env).get(key);if(!object)return null;return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox",...(privateImage?{'Content-Disposition':'attachment; filename="original-image"'}:{})}});}
export async function attach(request:Request,env:Env,reference:string){
 sameOrigin(request);const db=database(env),bucket=storage(env);
 const found=await db.prepare('SELECT created_at FROM inquiries WHERE reference=?').bind(reference).first<{created_at:string}>();
 const provided=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
 if(!found||!await equal(provided,await receipt(reference,env))||Date.now()-Date.parse(found.created_at)>3600000)fail(403,'Valid recent submission receipt required.');
 await rateLimit(db,'attachments:'+await clientKey(request,env),10);
 const form=await multipart(request,5*1024*1024+4096),f=file(form,'file',5*1024*1024),bytes=new Uint8Array(await f.arrayBuffer()),d=inspect(bytes);
 if(d.mime!==f.type)fail(422,'Attachment type mismatch.');
 const id=crypto.randomUUID(),objectKey=`attachments/${reference}/${id}`;
 await bucket.put(objectKey,bytes,{httpMetadata:{contentType:d.mime}});
 try{
 const result=await db.prepare('INSERT INTO attachments(id,reference,object_key,filename,mime,size) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM attachments WHERE reference=?)<3').bind(id,reference,objectKey,f.name.slice(0,150),d.mime,f.size,reference).run();
 if(!result.meta.changes){await bucket.delete(objectKey);fail(422,'Maximum three attachments per inquiry.');}
 }catch(e){await bucket.delete(objectKey);throw e;}
 return json({id},201);
}
