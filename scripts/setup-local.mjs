import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
try {
 await writeFile('.dev.vars',`INQUIRIES_ENABLED="true"\nLOCAL_ADMIN_TOKEN="${randomBytes(32).toString('hex')}"\nINQUIRY_ENCRYPTION_KEY="${randomBytes(32).toString('hex')}"\nRATE_LIMIT_SECRET="${randomBytes(32).toString('hex')}"\n`,{flag:'wx',mode:0o600});
 console.log('Created ignored, random local staging credentials. Values are not printed. Existing files are never overwritten.');
} catch (error) {if(error.code!=='EEXIST')throw error; console.log('Existing .dev.vars preserved.');}
