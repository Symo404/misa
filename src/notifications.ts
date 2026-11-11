import { Env,database } from './platform';
import { emailEnabled } from './inquiries';
/** Durable outbox: one atomic claim, bounded retries within Resend's 24-hour idempotency window. */
export async function deliver(env:Env,reference:string,send:typeof fetch=fetch){
 if(!emailEnabled(env))return;
 const db=database(env),now=Math.floor(Date.now()/1000);
 const row=await db.prepare("UPDATE notifications SET state='sending',attempts=attempts+1,lease_until=? WHERE reference=? AND state IN ('pending','retry','sending') AND next_attempt<=? AND lease_until<=? AND attempts<8 RETURNING attempts").bind(now+120,reference,now,now).first<{attempts:number}>();
 if(!row)return;
 const inquiry=await db.prepare('SELECT type,created_at FROM inquiries WHERE reference=?').bind(reference).first<{type:string;created_at:string}>();if(!inquiry)return;
 let result='temporary',providerId:string|null=null;
 // Never retry after the provider's idempotency retention period.
 if(Date.now()-Date.parse(inquiry.created_at)>20*3600000)result='expired';
 else try{
  const response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.EMAIL_API_KEY,'Content-Type':'application/json','Idempotency-Key':'misa-'+reference},body:JSON.stringify({from:env.EMAIL_FROM,to:[env.EMAIL_TO],subject:`MISA inquiry · ${inquiry.type} · ${reference}`,text:`A ${inquiry.type} inquiry has been saved.\nReference: ${reference}\nSign in to the MISA staff dashboard to review it. Customer details are not included in this notification.`}),signal:AbortSignal.timeout(15000)});
  if(response.ok){const body=await response.json() as {id?:string};if(body.id){providerId=body.id;result='sent';}}
  else result=response.status===429||response.status>=500?'temporary':'rejected';
 }catch{result='temporary';}
 const state=result==='sent'?'sent':result==='temporary'&&row.attempts<8?'retry':'failed';
 await db.batch([
 db.prepare('UPDATE notifications SET state=?,lease_until=0,next_attempt=?,last_result=?,provider_id=? WHERE reference=?').bind(state,now+Math.min(3600,30*2**row.attempts),result,providerId,reference),
 db.prepare('UPDATE inquiries SET notification_status=? WHERE reference=?').bind(state,reference),
 db.prepare('INSERT INTO notification_attempts(reference,attempt,result) VALUES(?,?,?)').bind(reference,row.attempts,result)]);
}
export async function drain(env:Env){if(!env.DB)return;const now=Math.floor(Date.now()/1000);await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now).run();if(!emailEnabled(env))return;await env.DB.batch([env.DB.prepare("UPDATE inquiries SET notification_status='failed' WHERE reference IN (SELECT reference FROM notifications WHERE attempts>=8 AND state='sending' AND lease_until<=?)").bind(now),env.DB.prepare("UPDATE notifications SET state='failed',last_result='attempt-exhausted' WHERE attempts>=8 AND state='sending' AND lease_until<=?").bind(now)]);const due=await env.DB.prepare("SELECT reference FROM notifications WHERE state IN ('pending','retry','sending') AND next_attempt<=? AND lease_until<=? LIMIT 25").bind(now,now).all<{reference:string}>();for(const row of due.results)await deliver(env,row.reference);await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now).run();}
