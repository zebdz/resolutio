/** Mail delivery accepts validated recipients and already rendered message text.
 * Adapters serialize addresses; only development transports may return a body preview. */
import { EmailAddress } from '@/domain/user/EmailAddress';

export interface EmailMessage {
  readonly to: EmailAddress;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
}

export interface EmailSendResult {
  success: boolean;
  /**
   * The rendered body, returned by the stub only so a developer can read the
   * code out of the log. Never populated by a real transport.
   */
  backdoorPreview?: string;
}

/**
 * Deliberately separate from OtpDeliveryChannel. The address-change notice is
 * plain mail with no code in it, so the OTP interface is the wrong shape for
 * it; EmailOtpDeliveryChannel is one consumer of this port, not the port.
 */
export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
