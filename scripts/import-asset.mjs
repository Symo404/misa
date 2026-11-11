import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
// Authentication uses a Cloudflare Access service token from the process environment.
// Never pass credentials as command-line arguments or put them in the repository.
const [file,alt,provenance,kind='ai-concept']=process.argv.slice(2);
const origin=process.env.MISA_STAFF_ORIGIN;
if(!file||!alt||!provenance||!origin)throw Error('Usage: MISA_STAFF_ORIGIN=https://staging-host npm run import:asset -- image.png "Alt text" "Approval record" [ai-concept|verified-photo]');
if(!origin.startsWith('https://'))throw Error('HTTPS is required.');
const bytes=await readFile(file);if(bytes.length>20*1024*1024)throw Error('Maximum original size is 20 MB.');
const metadata=await sharp(bytes,{limitInputPixels:20_000_000}).metadata();
if(!['png','jpeg','webp'].includes(metadata.format))throw Error('Only PNG, JPEG and WebP accepted.');
if((metadata.orientation||1)!==1)throw Error('Normalize EXIF orientation before importing; retain the source separately.');
const mime={png:'image/png',jpeg:'image/jpeg',webp:'image/webp'}[metadata.format];
const form=new FormData();form.append('original',new Blob([bytes],{type:mime}),'original.'+metadata.format);form.append('alt',alt);form.append('kind',kind);form.append('provenance',provenance);
for(const width of [640,1280]){const output=await sharp(bytes,{limitInputPixels:20_000_000}).resize({width,withoutEnlargement:true}).webp({quality:84}).toBuffer();form.append('variant'+width,new Blob([output],{type:'image/webp'}),'variant.webp');}
const response=await fetch(new URL('/api/admin/assets',origin),{method:'POST',headers:{Origin:new URL(origin).origin,'CF-Access-Client-Id':process.env.CF_ACCESS_CLIENT_ID||'','CF-Access-Client-Secret':process.env.CF_ACCESS_CLIENT_SECRET||''},body:form});
if(!response.ok)throw Error('Import failed with HTTP '+response.status+'. Check Access service policy, approved service identity and configuration.');
console.log(await response.json());
