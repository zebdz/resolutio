/** Assemble private poll mail from the saved cast receipt or the existing voter export.
 * A bundle can be prepared before claiming delivery, without contacting the mail transport. */
import { EmailSender, EmailMessage } from '@/application/auth/EmailSender';
import { EmailAddress } from '@/domain/user/EmailAddress';
import { Language } from '@/domain/user/UserValues';
import { UserId, PollId } from '@/domain/seal/SealValues';
import { success, Result } from '@/domain/shared/Result';
import {
  VoteReceiptView,
  ReceiptEmailStatus,
} from '@/application/poll/VoteReceiptView';
import { canonical } from '@/domain/seal/Canonical';
import { readManifest } from '@/domain/seal/RecordValidation';
import { SealExports } from './SealExports';

export interface Recipient {
  address: EmailAddress;
  language: Language;
}
export interface EvidenceRecipients {
  confirmed(
    id: UserId
  ): Promise<Result<Recipient | null, 'common.errors.unexpected'>>;
}
export interface EvidenceTemplate {
  renderEvidence(
    kind: 'voteReceipt' | 'sealBundle',
    locale: Language,
    values: Record<string, string>
  ): Promise<{ subject: string; text: string; html: string }>;
}
export class EvidenceMail {
  constructor(
    readonly recipients: EvidenceRecipients,
    private readonly templates: EvidenceTemplate,
    readonly sender: EmailSender,
    private readonly origin: string
  ) {}
  private verifyUrl(locale: Language, id: string) {
    return new URL(
      '/' + locale + '/verify/' + encodeURIComponent(id),
      this.origin
    ).href;
  }
  async receipt(
    view: Extract<VoteReceiptView, { kind: 'original' }>
  ): Promise<ReceiptEmailStatus> {
    const r = view.receipt;
    const recipient = await this.recipients.confirmed(UserId.parse(r.userId));

    if (!recipient.success) {
      return 'failed';
    }

    if (!recipient.value) {
      return 'unconfirmed';
    }

    const { language, address } = recipient.value;
    const rendered = await this.templates.renderEvidence(
      'voteReceipt',
      language,
      {
        title: r.pollTitle,
        time: r.leaves[0].preimage.castAt,
        choices: r.leaves
          .map((l) => l.questionText + ' — ' + l.answerText + '\n' + l.hash)
          .join('\n'),
        code: r.receiptSecret,
        url: this.verifyUrl(language, r.pollId),
      }
    );
    const result = await this.sender.send({
      ...rendered,
      to: address,
      attachments: [
        {
          filename: 'receipt.json',
          content: view.canonicalReceipt,
          contentType: 'application/json',
        },
      ],
    });

    return result.success ? 'sent' : 'failed';
  }
  async bundle(
    exports: Pick<SealExports, 'myProof' | 'proof'>,
    pollId: PollId,
    userId: UserId,
    recipient: Recipient
  ): Promise<Result<EmailMessage, string>> {
    const own = await exports.myProof(pollId, userId);

    if (!own.success) {
      return own;
    }

    const proof = await exports.proof(pollId);

    if (!proof.success) {
      return proof;
    }

    const bundle = own.value;
    const rendered = await this.templates.renderEvidence(
      'sealBundle',
      recipient.language,
      {
        title: bundle.poll === undefined ? '' : JSON.parse(bundle.poll).title,
        digest: bundle.rootDigest,
        time: readManifest(bundle.manifest).sealedAt,
        url: this.verifyUrl(recipient.language, pollId),
        status: proof.value.status,
      }
    );

    return success({
      ...rendered,
      to: recipient.address,
      attachments: [
        {
          filename: 'bundle.json',
          content: canonical(bundle),
          contentType: 'application/json',
        },
        {
          filename: pollId + '.ots',
          content: Buffer.from(proof.value.bytes),
          contentType: 'application/octet-stream',
        },
      ],
    });
  }
}
