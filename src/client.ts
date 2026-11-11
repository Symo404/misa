export const client=String.raw`
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelectorAll('[data-category]').forEach(card=>{card.hidden=button.dataset.filter!=='all'&&card.dataset.category!==button.dataset.filter;});}));
document.querySelectorAll('img[data-focal]').forEach(img=>img.style.objectPosition=img.dataset.focal);
const form=document.querySelector('#inquiry form');let submissionKey=null,lastPayload=null;
form?.addEventListener('submit',async e=>{
 e.preventDefault();const status=form.querySelector('[role=status]'),button=form.querySelector('button[type=submit]');if(button.disabled)return;
 const data=Object.fromEntries(new FormData(form));delete data.attachments;data.consent=form.querySelector('[name=consent]').checked;data.source=location.pathname;data.turnstileToken=form.querySelector('[name="cf-turnstile-response"]')?.value||'';
 const stable=JSON.stringify({...data,turnstileToken:''});if(stable!==lastPayload){submissionKey=crypto.randomUUID();lastPayload=stable;}
 const files=[...form.querySelector('[name=attachments]').files];if(files.length>3||files.some(f=>f.size>5*1024*1024)){status.textContent='Use up to three image attachments, each no larger than 5 MB.';return;}
 button.disabled=true;status.textContent='Saving your request…';
 try{
 const response=await fetch('/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':submissionKey},body:JSON.stringify(data),signal:AbortSignal.timeout(20000)}),result=await response.json();
 if(!response.ok)throw Error(result.error||'Could not save the request. Retry to check its status.');
 if(!result.persisted||!result.reference)throw Error('Persistence was not confirmed. Please retry.');
 status.textContent='Your request has been saved. Reference: '+result.reference+'. '+(result.notification==='sent'?'The team notification was delivered.':result.notification==='disabled'?'Email notifications are disabled. Your request is available to the MISA team in the dashboard.':'The team notification is '+result.notification+'.');
 for(const file of files){try{const upload=new FormData();upload.append('file',file);const r=await fetch('/api/inquiries/'+result.reference+'/attachments',{method:'POST',headers:{Authorization:'Bearer '+result.receipt},body:upload,signal:AbortSignal.timeout(20000)});if(!r.ok){const error=await r.json();throw Error(error.error);}}catch(e){status.textContent+=' An attachment could not be saved: '+e.message;}}
 form.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);button.textContent='Request saved';
 }catch(error){status.textContent=error.name==='TimeoutError'?'The connection timed out. Retry with this form to safely check whether your request was saved.':error.message;button.disabled=false;if(window.turnstile)window.turnstile.reset();}
});
if(!matchMedia('(prefers-reduced-motion: reduce)').matches){let pending=false;addEventListener('scroll',()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{document.querySelector('.hero')?.style.setProperty('--scroll',Math.min(scrollY*.04,18)+'px');pending=false;});},{passive:true});const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('revealed');observer.unobserve(e.target);}},{threshold:.1});document.querySelectorAll('.panel').forEach(p=>observer.observe(p));}
`;
