import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChangeUserEmailUseCase } from '../ChangeUserEmailUseCase';
import type { EmailSender } from '../EmailSender';
import type { EmailTemplateRenderer } from '../EmailTemplateRenderer';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { EmailAddress } from '@/domain/user/EmailAddress';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import type { UserRepository } from '@/domain/user/UserRepository';

describe('ChangeUserEmailUseCase', () => {
  let useCase: ChangeUserEmailUseCase;
  let userRepository: Partial<UserRepository>;
  let emailSender: EmailSender;
  let templateRenderer: EmailTemplateRenderer;

  function buildUser(email?: string, confirmed = false, id = 'user-1') {
    let user = User.reconstitute({
      id,
      firstName: 'Ivan',
      lastName: 'Ivanov',
      phoneNumber: PhoneNumber.create('+79161234567'),
      password: 'hash',
      language: 'ru',
      createdAt: new Date('2026-01-01'),
      nickname: Nickname.create('ivan_ivanov'),
    });

    if (email) {
      user = user.changeEmail(EmailAddress.create(email));

      if (confirmed) {
        user = user.confirmEmail();
      }
    }

    return user;
  }

  beforeEach(() => {
    userRepository = {
      findById: vi.fn().mockResolvedValue(buildUser()),
      findByEmail: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (u: User) => u),
    };
    emailSender = { send: vi.fn().mockResolvedValue({ success: true }) };
    templateRenderer = {
      renderOtp: vi.fn(),
      renderEmailChangedNotice: vi.fn().mockResolvedValue({
        subject: 'Адрес изменён',
        text: 'Адрес изменён на n•••@mail.ru',
      }),
    };

    useCase = new ChangeUserEmailUseCase({
      userRepository: userRepository as UserRepository,
      emailSender,
      templateRenderer,
    });
  });

  it('stores the new address unconfirmed', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      email: 'ivan@mail.ru',
    });

    expect(result.success).toBe(true);

    const saved = (userRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as User;
    expect(saved.email?.getValue()).toBe('ivan@mail.ru');
    expect(saved.hasConfirmedEmail()).toBe(false);
  });

  it('normalizes the address before storing it', async () => {
    await useCase.execute({ userId: 'user-1', email: '  Ivan@Mail.RU ' });

    const saved = (userRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as User;
    expect(saved.email?.getValue()).toBe('ivan@mail.ru');
  });

  it('rejects an invalid address', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      email: 'not-an-email',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.EMAIL_INVALID);
    }

    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('rejects an address already used by another account', async () => {
    (userRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('ivan@mail.ru', true, 'user-2')
    );

    const result = await useCase.execute({
      userId: 'user-1',
      email: 'ivan@mail.ru',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.EMAIL_TAKEN);
    }

    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('allows re-saving the address the user already owns', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('ivan@mail.ru', true)
    );
    (userRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('ivan@mail.ru', true)
    );

    const result = await useCase.execute({
      userId: 'user-1',
      email: 'ivan@mail.ru',
    });

    expect(result.success).toBe(true);
  });

  // Re-saving your own address still drops confirmation, so the notice would
  // be noise — the address did not actually move anywhere.
  it('does not notify when re-saving the same address', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('ivan@mail.ru', true)
    );
    (userRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('ivan@mail.ru', true)
    );

    await useCase.execute({ userId: 'user-1', email: 'ivan@mail.ru' });

    expect(emailSender.send).not.toHaveBeenCalled();
  });

  // The old address is the only party who can notice a hostile change.
  it('notifies the previous address when it was confirmed', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('old@mail.ru', true)
    );

    await useCase.execute({ userId: 'user-1', email: 'new@mail.ru' });

    expect(templateRenderer.renderEmailChangedNotice).toHaveBeenCalledWith(
      'ru',
      'n•••@mail.ru'
    );
    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'old@mail.ru' })
    );
  });

  it('does not notify when the previous address was never confirmed', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('old@mail.ru', false)
    );

    await useCase.execute({ userId: 'user-1', email: 'new@mail.ru' });

    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it('does not notify when there was no previous address', async () => {
    await useCase.execute({ userId: 'user-1', email: 'new@mail.ru' });

    expect(emailSender.send).not.toHaveBeenCalled();
  });

  // A failed courtesy notice must not roll back a change the user asked for.
  it('still succeeds when the notice cannot be delivered', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('old@mail.ru', true)
    );
    (emailSender.send as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
    });

    const result = await useCase.execute({
      userId: 'user-1',
      email: 'new@mail.ru',
    });

    expect(result.success).toBe(true);
  });

  it('still succeeds when the notice throws', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('old@mail.ru', true)
    );
    (emailSender.send as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('ECONNREFUSED')
    );
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await useCase.execute({
      userId: 'user-1',
      email: 'new@mail.ru',
    });

    expect(result.success).toBe(true);
    logged.mockRestore();
  });

  it('fails when the user does not exist', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    const result = await useCase.execute({
      userId: 'missing',
      email: 'ivan@mail.ru',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.USER_NOT_FOUND);
    }
  });
});
