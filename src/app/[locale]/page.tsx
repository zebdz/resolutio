import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Button } from '@/src/web/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import { LocaleSwitcher } from '@/web/components/LocaleSwitcher';
import { getVersion } from '@/src/lib/version';

export async function generateMetadata() {
  const t = await getTranslations('landing');

  return {
    title: t('title'),
  };
}

export default async function HomePage() {
  const t = await getTranslations('landing');

  return (
    <div className="min-h-screen bg-brand-green">
      {/* Top bar */}
      <header className="relative z-50">
        <div className="mx-auto max-w-7xl px-6 pt-6 lg:px-8">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/logo-icon.svg"
                alt="Organization logo"
                className="h-14 w-auto"
              />
              <span className="flex flex-col text-xs font-bold uppercase leading-relaxed tracking-wider text-white/90">
                {t('logoText')
                  .split(' ')
                  .map((word) => (
                    <span key={word}>{word}</span>
                  ))}
              </span>
            </div>
            <div className="rounded-lg bg-white/15 px-1 py-px text-white">
              <LocaleSwitcher />
            </div>
          </nav>
        </div>
      </header>

      {/* Hero section */}
      <main className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Hero text + CTA card */}
        <div className="grid gap-8 pt-12 sm:pt-16 lg:grid-cols-2 lg:gap-12 lg:pt-20">
          {/* Left: headline */}
          <div>
            <h1 className="uppercase">
              <span className="block text-7xl font-extrabold text-brand-yellow sm:text-8xl lg:text-9xl">
                {t('heroAccent')}
              </span>
              <span className="block text-3xl font-bold tracking-wide text-white sm:text-4xl lg:text-5xl">
                {t('heroLine1')}
              </span>
            </h1>
            <p className="mt-6 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl lg:text-5xl">
              {t('heroLine2')}
            </p>
          </div>

          {/* Right: CTA card */}
          <div className="flex items-start justify-center lg:justify-end">
            <div className="w-full max-w-md rounded-2xl bg-white/20 p-8 backdrop-blur-sm">
              <p className="mb-6 text-lg text-white">{t('subtitle')}</p>
              <div className="flex flex-col gap-3">
                <Button
                  color="amber"
                  className="w-full justify-center"
                  href="/register"
                >
                  {t('cta')}
                </Button>
                <Button
                  outline
                  className="w-full justify-center border-white/30 text-white hover:bg-white/10"
                  href="/login"
                >
                  {t('signIn')}
                </Button>
              </div>
              <p className="mt-4 text-sm font-semibold text-brand-yellow">
                ⚠️ {t('disclaimer')}
              </p>
            </div>
          </div>
        </div>

        {/* Illustrations: meeting → arrow → government */}
        <div className="mt-8 flex items-center gap-2 sm:gap-4 lg:gap-6">
          {/* Meeting SVG */}
          <div className="min-w-0 flex-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/meeting.svg"
              alt=""
              className="h-auto w-full"
              aria-hidden="true"
            />
          </div>

          {/* Arrow */}
          <div className="flex shrink-0 items-center">
            <svg
              className="h-8 w-10 text-brand-yellow sm:h-12 sm:w-20 lg:h-14 lg:w-24"
              viewBox="0 0 80 40"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M0 20h60M50 8l14 12-14 12"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Government illustration */}
          <div className="min-w-0 flex-1">
            <Image
              src="/images/government.svg"
              alt=""
              width={1150}
              height={661}
              className="h-auto w-full"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Feature badges + lightbulb */}
        <div className="mx-auto mt-12 max-w-5xl pb-16 sm:pb-20">
          {/* Voting badge - wide, centered */}
          <div className="mx-auto mb-4 flex max-w-sm items-center justify-center rounded-2xl bg-white/20 px-6 py-5 text-center text-sm font-semibold uppercase tracking-wide text-white sm:text-base">
            {t('features.voting')}
          </div>

          {/* 3-column grid: badges | lightbulb | badges */}
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-3">
            {/* Left badges */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-center rounded-2xl bg-white/20 px-4 py-5 text-center text-sm font-semibold uppercase tracking-wide text-white sm:text-base">
                {t('features.publicQuestions')}
              </div>
              <div className="flex items-center justify-center rounded-2xl bg-white/20 px-4 py-5 text-center text-sm font-semibold uppercase tracking-wide text-white sm:text-base">
                {t('features.users')}
              </div>
            </div>

            {/* Center lightbulb */}
            <div className="flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/lightbulb.svg"
                alt=""
                className="h-32 w-auto sm:h-40"
                aria-hidden="true"
              />
            </div>

            {/* Right badges */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-center rounded-2xl bg-white/20 px-4 py-5 text-center text-sm font-semibold uppercase tracking-wide text-white sm:text-base">
                {t('features.governance')}
              </div>
              <div className="flex items-center justify-center rounded-2xl bg-white/20 px-4 py-5 text-center text-sm font-semibold uppercase tracking-wide text-white sm:text-base">
                {t('features.documents')}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/20 px-6 py-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row">
          <Link
            href="/privacy"
            className="text-sm text-white/70 hover:text-white"
          >
            {t('privacyPolicy')}
          </Link>
          <div className="flex flex-col items-center gap-1 sm:items-end">
            <span className="text-sm text-white/50">{t('copyright')}</span>
            <span className="text-xs text-white/30">{getVersion()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
