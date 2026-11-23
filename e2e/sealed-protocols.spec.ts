/** Compare rendered results and English/Russian PDF downloads with a frozen poll after live
 * metadata changes. Exercise authenticated HTML, Flight and JSON disclosure in both Next modes. */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { localSealDatabase } from './sealDatabase';
import { sealedProtocolFixture } from './sealedProtocolFixture';

for (const anonymous of [false, true]) {
  test(
    'frozen protocols and current access for ' +
      (anonymous ? 'anonymous' : 'named') +
      ' poll',
    async ({ browser, baseURL }, info) => {
      const db = new PrismaClient({
        adapter: new PrismaPg({ connectionString: localSealDatabase() }),
      });

      try {
        const fixture = await sealedProtocolFixture(db, anonymous);

        const loggedIn = async (session: string) => {
          const context = await browser.newContext({
            baseURL,
            extraHTTPHeaders: { 'x-forwarded-proto': 'https' },
          });
          await context.addCookies([
            { name: 'session', value: session, url: baseURL! },
          ]);

          return context.newPage();
        };

        const member = await loggedIn(fixture.member.sessions[0].id);
        const admin = await loggedIn(fixture.admin.sessions[0].id);
        const route = '/api/polls/' + fixture.poll.id + '/results';
        const page = '/en/polls/' + fixture.poll.id + '/results';

        // Read the exported PDFs as an independent viewer. PDF generation dates may differ.
        async function downloadPdf(
          request: APIRequestContext,
          kind: string,
          locale: string,
          source = { route, prefix: '' }
        ) {
          const res = await request.get(
            source.route + '/' + kind + '?locale=' + locale
          );
          expect(res.status()).toBe(200);
          expect(res.headers()['content-type']).toContain('application/pdf');
          const path = info.outputPath(
            source.prefix + kind + '-' + locale + '.pdf'
          );
          await writeFile(path, await res.body());

          return execFileSync('pdftotext', ['-layout', path, '-'], {
            encoding: 'utf8',
          });
        }

        for (const locale of ['en', 'ru']) {
          const aggregate = await downloadPdf(member.request, 'pdf', locale);
          expect(aggregate.replace(/\s/g, '')).toContain(fixture.root);

          for (const expected of [
            fixture.title,
            'First Assembly',
            'First Board',
            'Approve repairs',
            '4.125',
          ]) {
            expect(aggregate).toContain(expected);
          }

          for (const hidden of [
            fixture.willing.firstName,
            fixture.willing.phoneNumber,
            'Changed',
          ]) {
            expect(aggregate).not.toContain(hidden);
          }

          expect(aggregate).toContain(
            '/' + locale + '/verify/' + fixture.poll.id
          );
          const signers = await downloadPdf(
            admin.request,
            'protocol-pdf',
            locale
          );

          for (const expected of [
            'First Board',
            fixture.title,
            fixture.willing.firstName,
            fixture.willing.phoneNumber,
            fixture.declining.firstName,
          ]) {
            expect(signers).toContain(expected);
          }

          for (const hidden of [
            'Renamed',
            fixture.undecided.firstName,
            fixture.declining.phoneNumber,
            'Changed',
          ]) {
            expect(signers).not.toContain(hidden);
          }

          expect(signers.replace(/\s/g, '')).toContain(fixture.root);

          if (!anonymous) {
            const named = await downloadPdf(
              member.request,
              'named-pdf',
              locale
            );

            for (const expected of [
              fixture.title,
              'First Assembly',
              'First Board',
              'East Wing',
              'Unit Olive',
              fixture.willing.firstName,
              '12.5',
            ]) {
              expect(named).toContain(expected);
            }

            expect(named.replace(/\s/g, '')).toContain(fixture.root);
            expect(named).not.toContain(fixture.willing.phoneNumber);
            expect(named).not.toContain('Changed');
          }
        }

        expect(
          (await member.request.get(route + '/protocol-pdf')).status()
        ).toBe(403);

        if (anonymous) {
          expect((await admin.request.get(route + '/named-pdf')).status()).toBe(
            403
          );
        }

        const hidden = [
          fixture.password,
          fixture.receiptSecret,
          fixture.willing.phoneNumber,
          fixture.declining.phoneNumber,
          fixture.member.sessions[0].id,
        ];

        if (anonymous) {
          hidden.push(
            fixture.willing.id,
            fixture.willing.firstName,
            fixture.declining.id
          );
        }

        const formats: {
          headers: Record<string, string>;
          contentType: string;
        }[] = [
          { headers: { accept: 'text/html' }, contentType: 'text/html' },
          { headers: { rsc: '1' }, contentType: 'text/x-component' },
        ];

        for (const { headers, contentType } of formats) {
          const response = await member.request.get(page, { headers });
          expect(response.status()).toBe(200);
          expect(response.headers()['content-type']).toContain(contentType);
          const body = await response.text();

          for (const value of hidden) {
            expect(
              body.includes(value),
              'private field in page transport'
            ).toBe(false);
          }
        }

        const data = await member.request.get(route);
        expect(data.status()).toBe(200);
        expect(data.headers()['cache-control']).toContain('no-store');
        const payload = await data.text();

        for (const value of hidden) {
          expect(payload.includes(value), 'private field in results JSON').toBe(
            false
          );
        }

        expect(payload).toContain(fixture.title);
        expect(payload).not.toContain(fixture.currentTitle);
        await member.goto(page);
        await expect(
          member.getByText(fixture.title, { exact: true })
        ).toBeVisible();
        await expect(
          member.getByText(fixture.root, { exact: true })
        ).toBeVisible();
        await expect(
          member.getByText(fixture.currentTitle, { exact: true })
        ).toHaveCount(0);

        if (!anonymous) {
          // Historical polls have no finish timestamp. A newly finished poll can be read while its seal is pending.
          for (const [state, finishedAt, label] of [
            ['ACTIVE', null, 'Preliminary results'],
            ['FINISHED', null, 'Unsealed'],
            ['FINISHED', new Date(), 'Sealing pending'],
          ] as const) {
            const live = await db.poll.create({
              data: {
                title: 'Unfinished business',
                description: 'Live source',
                state,
                finishedAt,
                createdBy: fixture.admin.id,
                organizationId: fixture.org.id,
                createdAt: new Date(Date.now() - 7200000),
                startDate: new Date(Date.now() - 3600000),
                endDate: new Date(Date.now() + 3600000),
                questions: {
                  create: {
                    text: 'Approve?',
                    answers: { create: { text: 'Yes' } },
                  },
                },
              },
            });

            for (const kind of ['pdf', 'named-pdf', 'protocol-pdf']) {
              const text = await downloadPdf(admin.request, kind, 'en', {
                route: '/api/polls/' + live.id + '/results',
                prefix: live.id + '-',
              });
              expect(text).toContain(label);
              expect(text).not.toContain('/verify/');
              expect(text).not.toMatch(/[a-f0-9]{64}/);
            }
          }
        }

        await db.organizationUser.delete({
          where: {
            organizationId_userId: {
              userId: fixture.member.id,
              organizationId: fixture.org.id,
            },
          },
        });

        for (const path of [
          route,
          route + '/pdf',
          route + '/named-pdf',
          route + '/protocol-pdf',
        ]) {
          const denied = await member.request.get(path);
          expect(denied.status()).toBe(403);
          expect(await denied.text()).not.toContain(fixture.title);
        }

        const adminView = await admin.request.get(route);
        expect(adminView.status()).toBe(200);
        expect(await adminView.text()).toContain(fixture.willing.phoneNumber);
        await db.organizationAdminUser.delete({
          where: {
            organizationId_userId: {
              organizationId: fixture.org.id,
              userId: fixture.admin.id,
            },
          },
        });
        expect(
          (await admin.request.get(route + '/protocol-pdf')).status()
        ).toBe(403);
        const formerAdmin = await admin.request.get(route);
        expect(formerAdmin.status()).toBe(200);
        expect(await formerAdmin.text()).not.toContain(
          fixture.willing.phoneNumber
        );

        await member.context().close();
        await admin.context().close();
      } finally {
        await db.$disconnect();
      }
    }
  );
}
