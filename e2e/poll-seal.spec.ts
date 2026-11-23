/** A real weighted cast through two signed-in browsers, public disclosure, local import and offline CLI.
 * All accounts, sessions and votes are synthetic and belong to the disposable database. */
import { test, expect, type Request } from '@playwright/test';
import { randomUUID, randomInt } from 'node:crypto';
import { readFile, writeFile, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { localSealDatabase } from './sealDatabase';

test('save a weighted ballot, seal it, and check its retained evidence independently', async ({
  browser,
  page,
  baseURL,
}, info) => {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: localSealDatabase() }),
  });
  const dir = await mkdtemp(join(tmpdir(), 'resolutio-browser-evidence-'));
  const token = randomUUID().slice(0, 8);
  const title = 'Private motion ' + token;
  const orgName = 'Private organization ' + token;
  const question = 'Approve repair ' + token + '?';
  const answer = 'Approve ' + token;
  const phone = '+1555' + randomInt(1000000, 9999999);
  const now = Date.now();
  const session = () => ({
    id: randomUUID(),
    expiresAt: new Date(now + 3600000),
  });

  async function account(role: string, number: string) {
    return db.user.create({
      data: {
        phoneNumber: number,
        nickname: role + token,
        firstName:
          role +
          token.replace(/\d/g, (digit) =>
            String.fromCharCode(97 + Number(digit))
          ),
        lastName: 'Member',
        language: 'en',
        password: 'fixture',
        confirmedAt: new Date(now),
        privacySetupCompleted: true,
        sessions: { create: session() },
      },
      include: { sessions: true },
    });
  }

  try {
    const voter = await account('Voter', phone + '1');
    const admin = await account('Admin', phone + '2');
    const org = await db.organization.create({
      data: { name: orgName, description: 'Fixture', createdById: admin.id },
    });
    await db.organizationUser.createMany({
      data: [voter, admin].map((u) => ({
        userId: u.id,
        organizationId: org.id,
        status: 'accepted',
      })),
    });
    await db.organizationAdminUser.create({
      data: { userId: admin.id, organizationId: org.id },
    });
    const poll = await db.poll.create({
      data: {
        title,
        description: 'Test ballot',
        createdBy: admin.id,
        organizationId: org.id,
        state: 'ACTIVE',
        anonymous: true,
        startDate: new Date(now - 60000),
        endDate: new Date(now + 3600000),
        questions: {
          create: {
            text: question,
            answers: {
              create: [{ text: answer }, { text: 'Abstain', order: 1 }],
            },
          },
        },
        participants: {
          create: [
            { userId: voter.id, userWeight: 2.125, snapshotAt: new Date(now) },
            { userId: admin.id, userWeight: 1, snapshotAt: new Date(now) },
          ],
        },
      },
    });
    const voteUrl = '/en/polls/' + poll.id + '/vote';
    const publicUrl = '/en/verify/' + poll.id;
    const privateUrl = '/en/polls/' + poll.id + '/verify-my-vote';
    const api = '/api/polls/' + poll.id + '/seal/';

    const authenticated = async (user: typeof voter) => {
      const context = await browser.newContext({
        baseURL,
        viewport: { width: 390, height: 844 },
      });
      await context.addCookies([
        { name: 'session', value: user.sessions[0].id, url: baseURL! },
      ]);

      return context.newPage();
    };

    const owner = await authenticated(voter);
    const votePage = await owner.goto(voteUrl);
    expect(votePage?.status()).toBe(200);
    await owner.getByRole('radio', { name: answer }).check();
    await owner
      .getByRole('button', { name: 'Finish Voting', exact: true })
      .click();
    const download = owner.getByRole('button', {
      name: 'Download receipt.json',
    });
    const received = owner.waitForEvent('download');
    await download.click();
    const receiptPath = join(dir, 'receipt.json');
    await (await received).saveAs(receiptPath);
    await info.attach('cast-receipt.json', {
      path: receiptPath,
      contentType: 'application/json',
    });
    const receiptText = await readFile(receiptPath, 'utf8');
    const receipt = JSON.parse(receiptText);
    expect(receipt.leaves[0].preimage.weight).toBe('2.125000');
    expect(receipt.leaves[0].answerText).toBe(answer);
    await owner
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write'], {
        origin: baseURL,
      });
    await owner.getByRole('button', { name: 'Copy code' }).press('Enter');
    await expect(
      owner.getByRole('status').filter({ hasText: 'Code copied.' })
    ).toBeVisible();
    expect(await owner.evaluate(() => navigator.clipboard.readText())).toBe(
      receipt.receiptSecret
    );
    expect(
      await owner.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    await owner.reload();
    await expect(
      owner.getByText(/current copy of your receipt/i)
    ).toBeVisible();
    await db.user.update({
      where: { id: voter.id },
      data: { email: token + '@example.invalid', emailConfirmedAt: new Date() },
    });
    const manager = await authenticated(admin);
    await manager.goto(voteUrl);
    await manager.getByRole('radio', { name: 'Abstain' }).check();
    await manager
      .getByRole('button', { name: 'Finish Voting', exact: true })
      .click();
    await expect(
      manager.getByRole('button', { name: 'Copy code' })
    ).toBeVisible();
    const otherCode = await manager.locator('code').first().innerText();
    expect(otherCode).toMatch(/^[a-f0-9]{64}$/);
    expect(otherCode).not.toBe(receipt.receiptSecret);
    await manager.goto('/en/polls?search=' + encodeURIComponent(title));
    await manager
      .getByRole('button', { name: 'Finish Poll', exact: true })
      .click();
    await expect(
      manager.getByText('Simulated timestamp', { exact: true })
    ).toBeVisible();
    const queue = await db.sealBundleDelivery.findMany({
      where: { pollId: poll.id },
    });
    expect(queue).toMatchObject([
      { userId: voter.id, status: 'PENDING', attemptStartedAt: null },
    ]);
    const retry = await manager.request.post('/api/internal/anchors/upgrade', {
      headers: { authorization: 'Bearer seal-browser-test' },
    });
    expect(retry.status()).toBe(200);
    expect(await retry.json()).toMatchObject({ deliveries: 0, errors: 0 });
    expect(
      await db.sealBundleDelivery.findMany({ where: { pollId: poll.id } })
    ).toMatchObject([
      { userId: voter.id, status: 'PENDING', attemptStartedAt: null },
    ]);
    const publicProof = await page.request.get(api + 'proof');
    expect(publicProof.status()).toBe(200);
    expect(publicProof.headers()['x-seal-anchor']).toBe('simulated');
    const [anonymous, member] = await Promise.all([
      page.request.get(publicUrl, { headers: { accept: 'text/html' } }),
      owner.request.get(publicUrl, { headers: { accept: 'text/html' } }),
    ]);
    await page.goto(publicUrl);
    await owner.goto(publicUrl);
    await page.waitForLoadState('networkidle');
    const forbidden = [
      title,
      orgName,
      question,
      answer,
      voter.id,
      voter.phoneNumber,
      voter.nickname,
      voter.firstName,
      token + '@example.invalid',
      admin.id,
      admin.phoneNumber,
      admin.firstName,
      otherCode,
      receipt.receiptSecret,
      'section_signers',
      'section_register',
    ];

    for (const response of [anonymous, member]) {
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('text/html');
      const html = await response.text();

      for (const value of forbidden) {
        expect(
          html.includes(value),
          'Public HTML includes private ballot data'
        ).toBe(false);
      }
    }

    await expect(
      owner.getByRole('link', { name: 'Download permitted record sections' })
    ).toBeVisible();
    const publicAccess = await page.request.get(api + 'access');
    const voterAccess = await owner.request.get(api + 'access');
    expect(await publicAccess.json()).toEqual({ viewer: 'guest' });
    expect(await voterAccess.json()).toEqual({ viewer: 'sections' });
    expect(voterAccess.headers()['cache-control']).toBe('private, no-store');
    await expect(
      page.getByRole('heading', { name: 'Verify the poll seal' })
    ).toBeVisible();
    await Promise.all([
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === api + 'proof' && response.ok()
      ),
      page
        .getByRole('button', { name: 'Check available evidence' })
        .press('Enter'),
    ]);
    await expect(page.getByText(/Simulated timestamp proof/)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    await page.goto('/ru/verify/' + poll.id);
    await expect(
      page.getByText('Тестовая метка времени', { exact: true })
    ).toBeVisible();
    expect((await page.request.get(api + 'my-proof')).status()).toBe(403);

    for (const [route, file] of [
      ['manifest', 'manifest.json'],
      ['sections', 'sections.json'],
      ['my-proof', 'bundle.json'],
      ['proof', 'manifest.json.ots'],
    ]) {
      const response = await owner.request.get(api + route);
      expect(response.status()).toBe(200);
      await writeFile(join(dir, file), await response.body());
    }

    const sections = JSON.parse(
      await readFile(join(dir, 'sections.json'), 'utf8')
    ).sections;
    expect(Object.keys(sections).sort()).toEqual(['poll', 'tallies']);
    await copyFile(
      resolve('build/verify-seal.mjs'),
      join(dir, 'verify-seal.mjs')
    );
    const cli = spawnSync(
      process.execPath,
      [
        'verify-seal.mjs',
        '--receipt',
        'receipt.json',
        '--bundle',
        'bundle.json',
        '--manifest',
        'manifest.json',
        '--sections',
        'sections.json',
        '--proof',
        'manifest.json.ots',
      ],
      { cwd: dir, env: { NODE_ENV: 'test' }, encoding: 'utf8' }
    );
    expect(cli.status, cli.stderr).toBe(0);
    expect(JSON.parse(cli.stdout)).toMatchObject({
      ballot: 'originalReceiptMatches',
      labels: 'verified',
      timestamp: 'simulated',
    });
    await owner.goto(privateUrl);
    await owner.waitForLoadState('networkidle');
    const requests: Request[] = [];
    owner.on('request', (request) => requests.push(request));
    const upload = owner.getByLabel(/^Original receipt \(receipt.json\)/i);
    const verify = owner.getByRole('button', {
      name: 'Verify my vote',
      exact: true,
    });
    // Warm the lazy verifier using an empty, synthetic file. Then disconnect
    // Chromium before selecting any retained evidence or typing a receipt code.
    await upload.setInputFiles({
      name: 'empty.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{}'),
    });
    await verify.click();
    await expect(
      owner
        .getByRole('alert')
        .filter({ hasText: 'This seal format version is not supported.' })
    ).toBeVisible();
    await owner.context().setOffline(true);
    await upload.setInputFiles(receiptPath);
    await verify.press('Enter');
    await expect(owner.getByText(/original receipt matches/i)).toBeVisible();
    await expect(
      owner.getByText('Question and answer texts match the sealed poll.')
    ).toBeVisible();
    await expect(
      owner.getByText(
        'This is a simulated timestamp. It provides no Bitcoin confirmation.'
      )
    ).toBeVisible();
    const altered = receiptText.replace(
      '"weight":"2.125000"',
      '"weight":"9.125000"'
    );
    expect(altered).not.toBe(receiptText);
    await upload.setInputFiles({
      name: 'altered.json',
      mimeType: 'application/json',
      buffer: Buffer.from(altered),
    });
    await verify.click();
    await expect(
      owner
        .getByRole('alert')
        .filter({ hasText: 'The poll record is inconsistent.' })
    ).toBeVisible();
    await expect(owner.getByText(/original receipt matches/i)).toHaveCount(0);
    await writeFile(join(dir, 'altered.json'), altered);
    const rejected = spawnSync(
      process.execPath,
      [
        'verify-seal.mjs',
        '--receipt',
        'altered.json',
        '--bundle',
        'bundle.json',
      ],
      { cwd: dir, env: { NODE_ENV: 'test' }, encoding: 'utf8' }
    );
    expect(rejected.status, rejected.stderr).toBe(1);
    await owner
      .getByRole('radio', { name: 'Check current inclusion only' })
      .check();
    await owner
      .getByLabel(/Your saved receipt code/)
      .fill(receipt.receiptSecret);
    await verify.press('Enter');
    await expect(
      owner.getByText(/Your code matches the choices/)
    ).toBeVisible();

    for (const request of requests) {
      const url = new URL(request.url());
      const data = request.url() + ' ' + (request.postData() ?? '');

      for (const privateValue of [
        receipt.receiptSecret,
        voter.id,
        title,
        question,
        answer,
        '2.125000',
        receipt.leaves[0].hash,
        receipt.leaves[0].preimage.salt,
      ]) {
        expect(data).not.toContain(privateValue);
      }

      if (request.method() !== 'GET' || request.postDataBuffer() !== null) {
        // Next's development overlay requests source-mapped stack locations.
        expect(url.href).toBe(
          new URL('/__nextjs_original-stack-frames', baseURL).href
        );
        expect(request.method()).toBe('POST');
        expect(Object.keys(request.postDataJSON()).sort()).toEqual([
          'frames',
          'isAppDirectory',
          'isEdgeServer',
          'isServer',
        ]);
      }
    }

    await owner.context().setOffline(false);
    await db.organizationUser.deleteMany({
      where: { userId: voter.id, organizationId: org.id },
    });
    const fetched: Promise<string>[] = [];
    owner.on('response', (response) => {
      if (
        new URL(response.url()).pathname.startsWith(api) &&
        response.headers()['content-type']?.includes('application/json')
      ) {
        fetched.push(response.text());
      }
    });
    const revoked = await owner.request.get(privateUrl, {
      headers: { accept: 'text/html' },
    });
    expect(revoked.status()).toBe(200);
    const revokedHtml = await revoked.text();
    await owner.reload();

    for (const label of [title, question, answer]) {
      expect(
        revokedHtml.includes(label),
        'Private HTML exposes a label after access revocation'
      ).toBe(false);
    }

    await owner
      .getByRole('radio', { name: 'Check current inclusion only' })
      .check();
    await verify.click();
    await expect(
      owner.getByText(/Sealed question and answer texts are unavailable/)
    ).toBeVisible();
    await owner
      .getByText('Use a saved copy of the poll questions and answers')
      .click();
    await owner
      .getByLabel(/Saved sections export/)
      .setInputFiles(join(dir, 'sections.json'));
    await verify.click();
    await expect(
      owner.getByText('Question and answer texts match the sealed poll.')
    ).toBeVisible();
    expect((await owner.request.get(api + 'sections')).status()).toBe(403);
    const afterRevocation = await owner.request.get(api + 'access');
    expect(await afterRevocation.json()).toEqual({ viewer: 'signedIn' });
    const ownProof = await owner.request.get(api + 'my-proof');
    expect(ownProof.status()).toBe(200);
    const bundle = await ownProof.json();
    expect(bundle).not.toHaveProperty('poll');
    expect(bundle.leaves).toMatchObject([{ preimage: { userId: voter.id } }]);
    expect(bundle.leaves[0].path).toHaveLength(1);

    expect(fetched.length).toBeGreaterThan(0);

    for (const payload of [
      await ownProof.text(),
      ...(await Promise.all(fetched)),
    ]) {
      for (const privateLabel of [
        title,
        orgName,
        question,
        answer,
        admin.id,
        admin.phoneNumber,
        otherCode,
      ]) {
        expect(
          payload.includes(privateLabel),
          'A browser response exposes a label after revocation'
        ).toBe(false);
      }
    }

    await owner.context().close();
    await manager.context().close();
  } finally {
    await db.$disconnect();
    await rm(dir, { recursive: true, force: true });
  }
});
