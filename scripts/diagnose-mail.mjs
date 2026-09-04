/**
 * Read-only diagnostics for the mail setup. No credentials, no sending —
 * it only looks up DNS and inspects what the server offers.
 *
 *   node scripts/diagnose-mail.mjs
 *
 * Run it with the VPN OFF: a VPN's resolver can report ENOTFOUND/ESERVFAIL
 * for records that exist, which makes every finding here untrustworthy.
 */
import dns from 'node:dns/promises';
import { Resolver } from 'node:dns/promises';
import net from 'node:net';
import tls from 'node:tls';

const DOMAIN = 'resolutio.site';
const MAIL_HOST = `mail.${DOMAIN}`;
const PORTS = [25, 465, 587];
const TIMEOUT = 8000;

const out = [];

function log(line = '') {
  console.log(line);
  out.push(line);
}

function section(title) {
  log(`\n${'─'.repeat(64)}\n${title}\n${'─'.repeat(64)}`);
}

async function lookup(resolver, type, name) {
  try {
    const value = await resolver.resolve(name, type);

    return { ok: true, value };
  } catch (error) {
    return { ok: false, code: error.code };
  }
}

function show(label, result) {
  if (result.ok) {
    log(`  ${label.padEnd(34)} ${JSON.stringify(result.value).slice(0, 150)}`);
  } else {
    log(`  ${label.padEnd(34)} ${result.code}`);
  }
}

// ── 1. DNS through whatever resolver this machine uses ────────────────────
async function systemDns() {
  section('1. DNS (system resolver)');
  log(`  servers in use: ${dns.getServers().join(', ')}`);
  log('');

  const r = new Resolver();

  for (const [type, name] of [
    ['A', DOMAIN],
    ['A', MAIL_HOST],
    ['A', `smtp.${DOMAIN}`],
    ['MX', DOMAIN],
    ['TXT', DOMAIN],
    ['TXT', `_dmarc.${DOMAIN}`],
    ['NS', DOMAIN],
  ]) {
    show(`${type} ${name}`, await lookup(r, type, name));
  }
}

// ── 2. Ask the authoritative nameservers directly ─────────────────────────
async function authoritativeDns() {
  section('2. DNS (authoritative nameservers, bypassing any cache)');

  const ns = await lookup(new Resolver(), 'NS', DOMAIN);

  if (!ns.ok) {
    log(`  Could not discover nameservers: ${ns.code}`);

    return;
  }

  for (const host of ns.value) {
    let ips;

    try {
      ips = await dns.resolve4(host);
    } catch (error) {
      log(`  ${host}: cannot resolve nameserver address (${error.code})`);
      continue;
    }

    log(`\n  via ${host} (${ips.join(', ')})`);
    const r = new Resolver();
    r.setServers(ips);

    for (const [type, name] of [
      ['A', MAIL_HOST],
      ['MX', DOMAIN],
      ['TXT', DOMAIN],
    ]) {
      show(`    ${type} ${name}`, await lookup(r, type, name));
    }
  }
}

// ── 3. Are the SMTP ports reachable? ──────────────────────────────────────
function probePort(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let banner = '';

    const done = (verdict) => {
      socket.destroy();
      resolve(verdict);
    };

    socket.setTimeout(TIMEOUT);
    socket.on('connect', () => {
      if (port === 465) {
        done('open (implicit TLS — no plaintext banner expected)');
      }
    });
    socket.on('data', (d) => {
      banner += d.toString();
      done(`open — ${banner.trim().split('\n')[0]}`);
    });
    socket.on('timeout', () =>
      done(port === 465 ? 'open, but no TLS handshake' : 'TIMEOUT')
    );
    socket.on('error', (e) => done(`closed (${e.code})`));
  });
}

async function ports() {
  section('3. SMTP port reachability');

  let host = MAIL_HOST;

  try {
    await dns.resolve4(MAIL_HOST);
  } catch {
    host = DOMAIN;
    log(`  ${MAIL_HOST} does not resolve — probing ${DOMAIN} instead\n`);
  }

  for (const port of PORTS) {
    log(`  ${host}:${String(port).padEnd(4)} ${await probePort(host, port)}`);
  }
}

// ── 4 & 5. What certificate does the mail server present? ─────────────────
function describeCert(cert, authorized, authError, servername) {
  log(`    subject CN   ${cert.subject?.CN ?? '<none>'}`);
  log(`    altNames     ${cert.subjectaltname ?? '<none>'}`);
  log(`    issuer       ${cert.issuer?.O ?? cert.issuer?.CN ?? '<none>'}`);
  log(`    valid to     ${cert.valid_to ?? '?'}`);
  log(
    `    validates as ${servername}: ${authorized ? 'YES' : `NO — ${authError}`}`
  );
}

function implicitTls(host) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host, port: 465, servername: host, rejectUnauthorized: false },
      () => {
        describeCert(
          socket.getPeerCertificate(),
          socket.authorized,
          socket.authorizationError,
          host
        );
        socket.destroy();
        resolve();
      }
    );
    socket.setTimeout(TIMEOUT, () => {
      log('    TLS handshake TIMED OUT — 465 may not be implicit TLS here');
      socket.destroy();
      resolve();
    });
    socket.on('error', (e) => {
      log(`    error: ${e.code ?? e.message}`);
      resolve();
    });
  });
}

function startTls(host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port: 587 });
    let buf = '';
    let stage = 0;

    socket.setTimeout(TIMEOUT, () => {
      log(`    timed out at stage ${stage}`);
      socket.destroy();
      resolve();
    });

    socket.on('error', (e) => {
      log(`    error: ${e.code ?? e.message}`);
      resolve();
    });

    socket.on('data', (d) => {
      buf += d.toString();

      if (stage === 0 && buf.includes('220 ')) {
        stage = 1;
        buf = '';
        socket.write(`EHLO ${DOMAIN}\r\n`);

        return;
      }

      if (stage === 1 && /^250 /m.test(buf)) {
        log('    EHLO capabilities:');
        buf
          .split('\n')
          .filter((l) => l.trim())
          .forEach((l) => log(`      ${l.trim()}`));

        if (!buf.includes('STARTTLS')) {
          log('    no STARTTLS offered');
          socket.destroy();
          resolve();

          return;
        }

        stage = 2;
        buf = '';
        socket.write('STARTTLS\r\n');

        return;
      }

      if (stage === 2 && buf.includes('220 ')) {
        stage = 3;
        const secured = tls.connect(
          { socket, servername: host, rejectUnauthorized: false },
          () => {
            log('');
            describeCert(
              secured.getPeerCertificate(),
              secured.authorized,
              secured.authorizationError,
              host
            );
            secured.destroy();
            resolve();
          }
        );
        secured.on('error', (e) => {
          log(`    tls error: ${e.code ?? e.message}`);
          resolve();
        });
      }
    });
  });
}

async function certificates() {
  let host = MAIL_HOST;

  try {
    await dns.resolve4(MAIL_HOST);
  } catch {
    host = DOMAIN;
  }

  section(`4. Certificate on port 465 (implicit TLS) — ${host}`);
  await implicitTls(host);

  section(`5. Port 587 capabilities and STARTTLS certificate — ${host}`);
  await startTls(host);
}

// ── 6. The web certificate, for comparison ────────────────────────────────
function webCert() {
  section('6. HTTPS certificate on the same domain (for comparison)');

  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: DOMAIN,
        port: 443,
        servername: DOMAIN,
        rejectUnauthorized: false,
      },
      () => {
        describeCert(
          socket.getPeerCertificate(),
          socket.authorized,
          socket.authorizationError,
          DOMAIN
        );
        socket.destroy();
        resolve();
      }
    );
    socket.setTimeout(TIMEOUT, () => {
      log('    timeout');
      socket.destroy();
      resolve();
    });
    socket.on('error', (e) => {
      log(`    error: ${e.code ?? e.message}`);
      resolve();
    });
  });
}

log(`Mail diagnostics for ${DOMAIN} — ${new Date().toISOString()}`);
log('Run with the VPN OFF, or the DNS answers below cannot be trusted.');

await systemDns();
await authoritativeDns();
await ports();
await certificates();
await webCert();

log('\nDone. Paste the whole output back.');
