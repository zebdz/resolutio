/** Compose evidence mail from a confirmed address and the recipient's current
 * language. Query only contact fields and build links from the deployment origin. */
import { SITE_ORIGIN } from '@/infrastructure/shared/siteOrigin';
import { PrismaClient } from '@/generated/prisma/client';
import { EmailAddress } from '@/domain/user/EmailAddress';
import { Language } from '@/domain/user/UserValues';
import { success, failure } from '@/domain/shared/Result';
import {
  EvidenceMail,
  EvidenceRecipients,
} from '@/application/seal/EvidenceMail';
import { NextIntlEmailTemplateRenderer } from './NextIntlEmailTemplateRenderer';
import { createEmailSenderFromEnv } from './emailSenderFactory';

export function createEvidenceMail(
  prisma: PrismaClient,
  sender = createEmailSenderFromEnv()
) {
  const recipients: EvidenceRecipients = {
    async confirmed(id) {
      try {
        const row = await prisma.user.findUnique({
          where: { id },
          select: { email: true, emailConfirmedAt: true, language: true },
        });

        if (!row?.email || !row.emailConfirmedAt) {
          return success(null);
        }

        return success({
          address: EmailAddress.create(row.email),
          language: Language.parse(row.language),
        });
      } catch {
        return failure('common.errors.unexpected');
      }
    },
  };

  return new EvidenceMail(
    recipients,
    new NextIntlEmailTemplateRenderer(),
    sender,
    SITE_ORIGIN
  );
}
