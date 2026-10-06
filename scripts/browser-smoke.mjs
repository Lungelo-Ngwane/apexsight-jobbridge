import { spawn } from 'node:child_process';
import { once } from 'node:events';
const origin='http://127.0.0.1:4173';
const env={...process.env,VITE_SUPABASE_URL:'http://127.0.0.1:54321',VITE_SUPABASE_ANON_KEY:'fictional-public-key',VITE_APP_URL:origin};
try { await fetch(origin,{signal:AbortSignal.timeout(500)}); throw new Error('Smoke-test port 4173 is already in use'); }
catch(error) { if(error.message==='Smoke-test port 4173 is already in use') throw error; }
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4173','--strictPort'],{env,stdio:'ignore',windowsHide:true});
server.on('error',error=>{ console.error(error.message); });
let ready=false;
try {
  for(let attempt=0;attempt<60;attempt++){
    try { ready=(await fetch(origin,{signal:AbortSignal.timeout(500)})).ok; } catch { /* server is still starting */ }
    if(ready)break;
    if(server.exitCode!==null)throw new Error('Smoke-test server exited before it became ready');
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!ready)throw new Error('Smoke-test server did not become ready');
  const runner=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test'],{env,stdio:'inherit',windowsHide:true});
  runner.on('error',error=>{ console.error(error.message); });
  const [code]=await once(runner,'exit');process.exitCode=code ?? 1;
} finally {
  if(server.exitCode===null){const exited=once(server,'exit');server.kill();await exited;}
}
