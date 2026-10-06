import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const root='supabase/functions';
const files=fs.readdirSync(root,{withFileTypes:true}).filter(entry=>entry.isDirectory())
  .map(entry=>`${root}/${entry.name}/index.ts`).filter(file=>fs.existsSync(file));
const result=spawnSync(process.execPath,['node_modules/deno/bin.cjs','check','--config',`${root}/deno.json`,...files],{stdio:'inherit'});
if(result.error) throw result.error;
process.exitCode=result.status ?? 1;
