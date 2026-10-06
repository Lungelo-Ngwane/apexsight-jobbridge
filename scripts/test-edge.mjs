import { spawnSync } from 'node:child_process';
const result=spawnSync(process.execPath,['node_modules/deno/bin.cjs','test','--config','supabase/functions/deno.json',
  '--allow-env=PAYSTACK_SECRET_KEY','supabase/functions/_shared/payments_test.ts'],{stdio:'inherit'});
if(result.error) throw result.error;
process.exitCode=result.status ?? 1;
