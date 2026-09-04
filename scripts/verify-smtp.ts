/**
 * Sends one real email through the configured SMTP transport, using the same
 * factory and adapter the app uses. Proves the credentials, TLS mode and
 * envelope sender actually work before anything depends on them.
 *
 *   npx tsx scripts/verify-smtp.ts you@example.com
 *
 * Reads SMTP_* from .env. Nothing is written to the database and no OTP is
 * issued — this only exercises the transport.
 */
import 'dotenv/config';
import { createEmailSenderFromEnv } from '../src/infrastructure/email/emailSenderFactory';
import { StubEmailSender } from '../src/infrastructure/email/StubEmailSender';

const REQUIRED = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'];

function mask(value: string | undefined): string {
  if (!value) {
    return '<unset>';
  }

  return value.length <= 2 ? '••' : `${value[0]}••••${value[value.length - 1]}`;
}

async function main() {
  const recipient = process.argv[2];

  if (!recipient || !recipient.includes('@')) {
    console.error(
      'Usage: npx tsx scripts/verify-smtp.ts <recipient@example.com>'
    );
    process.exit(1);
  }

  const port = process.env.SMTP_PORT ?? '587';
  const secure = process.env.SMTP_SECURE === 'true';

  console.log('SMTP configuration:');
  console.log(`  host      ${process.env.SMTP_HOST ?? '<unset>'}`);
  console.log(`  port      ${port}`);
  console.log(`  secure    ${secure}  (implicit TLS)`);
  console.log(`  user      ${process.env.SMTP_USER ?? '<unset>'}`);
  console.log(`  password  ${mask(process.env.SMTP_PASSWORD)}`);
  console.log(`  from      ${process.env.SMTP_FROM ?? '<unset>'}`);
  console.log(`  to        ${recipient}\n`);

  const missing = REQUIRED.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`Missing in .env: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Port 465 is implicit TLS and 587 is STARTTLS. Getting this pair wrong is
  // the single most common cause of a hang rather than a clean error.
  if (port === '465' && !secure) {
    console.error(
      'Port 465 expects SMTP_SECURE=true (implicit TLS). As configured this will hang or fail.'
    );
    process.exit(1);
  }

  if (port === '587' && secure) {
    console.error(
      'Port 587 expects SMTP_SECURE=false (STARTTLS). As configured this will hang or fail.'
    );
    process.exit(1);
  }

  const sender = createEmailSenderFromEnv();

  if (sender instanceof StubEmailSender) {
    console.error(
      'The factory returned the stub, so SMTP_HOST is not set. Nothing was sent.'
    );
    process.exit(1);
  }

  const stamp = new Date().toISOString();
  const result = await sender.send({
    to: recipient,
    subject: `Resolutio SMTP test ${stamp}`,
    text:
      `This is a test message from scripts/verify-smtp.ts.\n\n` +
      `Sent at ${stamp}.\n\n` +
      `If you are reading this, the transport works and password reset ` +
      `emails will be delivered.`,
  });

  if (!result.success) {
    console.error(
      '\nFAILED — the transport rejected the message. The adapter logs the ' +
        'reason above (it deliberately never logs the body).'
    );
    process.exit(1);
  }

  console.log(`Sent. Check ${recipient} — including its spam folder.`);
  console.log(
    'If it lands in spam, the domain needs SPF/DKIM/DMARC records before ' +
      'reset emails are reliable.'
  );
}

main().catch((error) => {
  console.error('\nFAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
