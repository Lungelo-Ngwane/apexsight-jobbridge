import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
const patterns = {
  'password hash': /\$2[aby]\$[0-9]{2}\$[A-Za-z0-9./]{40,}/,
  'private key': /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  'provider secret': /(?:sk_(?:live|test)_|sk-proj-|sb_secret_)[A-Za-z0-9_-]{16,}/,
  'auth export': /"(?:encrypted_password|refresh_token|confirmation_token)"\s*:\s*"[^"\s]+/,
};
const findings = new Set();
function inspect(path, source) {
  for (const [type, pattern] of Object.entries(patterns)) if (pattern.test(source)) findings.add(path + ': ' + type);
  for (const match of source.matchAll(/eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    let role; try { role = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString()).role; } catch { role = null; }
    if (role !== 'anon') findings.add(path + ': ' + (role === 'service_role' ? 'service-role JWT' : 'non-public JWT'));
  }
}
if (process.argv.includes('--bundle')) {
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const path = dir + '/' + entry.name;
      if (entry.isDirectory()) walk(path);
      else if (/\.(?:js|html|css|json|map)$/.test(path)) inspect(path, fs.readFileSync(path, 'utf8'));
    }
  }
  if (!fs.existsSync('dist')) throw new Error('Build dist before scanning bundles');
  walk('dist');
} else if (process.argv.includes('--history')) {
  const seen = new Set();
  for (const line of git('rev-list', '--objects', '--all').trim().split('\n')) {
    const split = line.indexOf(' '); if (split < 0) continue;
    const object = line.slice(0, split), path = line.slice(split + 1);
    if (seen.has(object)) continue; seen.add(object);
    if (git('cat-file', '-t', object).trim() === 'blob') inspect(path, git('cat-file', 'blob', object));
  }
} else {
  const paths = new Set(git('ls-files', '--cached', '--others', '--exclude-standard').trim().split('\n'));
  for (const path of paths) {
    if (!fs.existsSync(path) || !fs.statSync(path).isFile()) continue;
    if (/^(?:backups\/)|(?:backup.*\.sql$)|\.(?:dump|bak|stackdump)$/.test(path)) findings.add(path + ': tracked export/crash artifact');
    inspect(path, fs.readFileSync(path, 'utf8'));
  }
}
for (const finding of findings) console.error(finding); // Never print matched values.
console.log(findings.size ? 'Security scan requires remediation: ' + findings.size + ' findings' : 'Security pattern scan passed');
process.exitCode = findings.size ? 1 : 0;
