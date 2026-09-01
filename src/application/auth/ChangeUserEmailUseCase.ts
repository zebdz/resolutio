import { UserRepository } from '@/domain/user/UserRepository';
import { EmailAddress } from '@/domain/user/EmailAddress';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { Result, success, failure } from '@/domain/shared/Result';
import { EmailSender } from './EmailSender';
import { EmailTemplateRenderer } from './EmailTemplateRenderer';
import { maskEmail } from './maskEmail';

export interface ChangeUserEmailInput {
  userId: string;
  email: string;
}

interface Dependencies {
  userRepository: UserRepository;
  emailSender: EmailSender;
  templateRenderer: EmailTemplateRenderer;
}

export class ChangeUserEmailUseCase {
  private readonly userRepository: UserRepository;
  private readonly emailSender: EmailSender;
  private readonly templateRenderer: EmailTemplateRenderer;

  constructor(deps: Dependencies) {
    this.userRepository = deps.userRepository;
    this.emailSender = deps.emailSender;
    this.templateRenderer = deps.templateRenderer;
  }

  async execute(
    input: ChangeUserEmailInput
  ): Promise<Result<{ changed: true }, string>> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      return failure(UserDomainCodes.USER_NOT_FOUND);
    }

    let email: EmailAddress;

    try {
      email = EmailAddress.create(input.email);
    } catch {
      return failure(UserDomainCodes.EMAIL_INVALID);
    }

    const owner = await this.userRepository.findByEmail(email);

    if (owner && owner.id !== user.id) {
      return failure(UserDomainCodes.EMAIL_TAKEN);
    }

    const previous = user.hasConfirmedEmail() ? user.email : undefined;

    await this.userRepository.save(user.changeEmail(email));

    // Tell the old address what happened — it is the only party in a position
    // to notice a hostile change. Only a confirmed address is worth writing
    // to; an unconfirmed one was never proven to belong to anyone. Re-saving
    // the same address is not a move, so it earns no notice.
    if (previous && previous.getValue() !== email.getValue()) {
      await this.notifyPreviousAddress(
        previous.getValue(),
        email.getValue(),
        user.language
      );
    }

    return success({ changed: true });
  }

  /**
   * Best effort by design: a courtesy notice that fails to send must not roll
   * back a change the user explicitly asked for, so every failure here is
   * swallowed after logging.
   */
  private async notifyPreviousAddress(
    previousAddress: string,
    newAddress: string,
    locale: string
  ): Promise<void> {
    try {
      const { subject, text } =
        await this.templateRenderer.renderEmailChangedNotice(
          locale,
          maskEmail(newAddress)
        );

      await this.emailSender.send({ to: previousAddress, subject, text });
    } catch (error) {
      console.error(
        'Failed to notify the previous email address of a change:',
        error instanceof Error ? error.message : error
      );
    }
  }
}
