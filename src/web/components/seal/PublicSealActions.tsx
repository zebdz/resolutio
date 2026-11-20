'use client';
/** Keep session-specific links and recovery in a private HTTP request, so rendering the public page reads public data only. */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/src/i18n/routing';
import { Subheading } from '@/web/components/catalyst/heading';
import { VerifySealPanel } from './VerifySealPanel';

interface Props {
  readonly pollId: string;
  readonly locale: string;
  readonly recover: boolean;
  readonly record: {
    manifest: string;
    rootDigest: string;
    proofAvailable: boolean;
  } | null;
}

type Viewer = 'sections' | 'signedIn' | 'guest' | 'unavailable';

async function readViewer(url: string, signal: AbortSignal): Promise<Viewer> {
  try {
    const result = await fetch(url, { cache: 'no-store', signal });

    if (!result.ok) {
      return 'unavailable';
    }

    const body = await result.json();
    const viewer: unknown = body?.viewer;

    return viewer === 'sections' || viewer === 'signedIn' || viewer === 'guest'
      ? viewer
      : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

const linkStyle =
  'cursor-pointer text-blue-700 underline underline-offset-2 dark:text-blue-400';
const commandsStyle =
  'whitespace-pre-wrap break-all rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-800';

export function PublicSealActions({ pollId, locale, record, recover }: Props) {
  const t = useTranslations('sealPublic');
  const [viewer, setViewer] = useState<Viewer | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const url =
      '/api/polls/' +
      encodeURIComponent(pollId) +
      '/seal/access' +
      (recover ? '?recover=1' : '');
    void readViewer(url, controller.signal).then((access) => {
      if (!controller.signal.aborted) {
        setViewer(access);
      }
    });

    return () => controller.abort();
  }, [pollId, recover]);

  if (!record) {
    return null;
  }

  const { manifest, rootDigest, proofAvailable } = record;
  const canReadSections = viewer === 'sections';
  const base = '/api/polls/' + pollId + '/seal/';
  const proof = './' + pollId + '.ots';
  const checkCommand =
    'node verify-seal.mjs --manifest manifest.json' +
    (canReadSections ? ' --sections sections.json' : '') +
    (proofAvailable ? ' --proof ' + proof : '');
  const otsCommands = [
    'ots --no-cache info ' + proof,
    'ots --no-cache upgrade ' + proof,
    'ots --no-cache verify -f manifest.json ' + proof,
    'ots --no-cache verify -d ' + rootDigest + ' ' + proof,
  ];

  return (
    <>
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <a className={linkStyle} href={base + 'manifest'} download>
          {t('manifestDownload')}
        </a>
        {proofAvailable ? (
          <a className={linkStyle} href={base + 'proof'} download>
            {t('proofDownload')}
          </a>
        ) : (
          <span>{t('proofUnavailable')}</span>
        )}
        {canReadSections && (
          <a className={linkStyle} href={base + 'sections'} download>
            {t('sectionsDownload')}
          </a>
        )}
        {(!viewer || viewer === 'guest') && (
          <Link className={linkStyle} href="/login">
            {t('signInSections')}
          </Link>
        )}
        {/* A document navigation lets middleware capture the voter page for the login return. */}
        <a
          className={linkStyle}
          href={'/' + locale + '/polls/' + pollId + '/verify-my-vote'}
        >
          {t(
            viewer === 'signedIn' || viewer === 'sections'
              ? 'myVote'
              : 'signInVote'
          )}
        </a>
      </nav>
      {viewer === 'unavailable' && (
        <p role="alert">{t('downloadUnavailable')}</p>
      )}
      <VerifySealPanel
        pollId={pollId}
        manifest={manifest}
        rootDigest={rootDigest}
        canReadSections={canReadSections}
        hasProof={proofAvailable}
        loadingAccess={viewer === null}
      />
      <section className="space-y-3">
        <Subheading>{t('recipeTitle')}</Subheading>
        <p>{t('recipeIntro')}</p>
        <pre className={commandsStyle}>{checkCommand}</pre>
        <p>{t('otsInfo')}</p>
        <pre className={commandsStyle}>{otsCommands.join('\n')}</pre>
        <a
          className={linkStyle}
          href="https://github.com/opentimestamps/opentimestamps-client"
        >
          {t('otsClient')}
        </a>
      </section>
    </>
  );
}
