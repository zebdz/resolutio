'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import * as Headless from '@headlessui/react';
import clsx from 'clsx';
import { Button } from '@/src/web/components/catalyst/button';
import { Textarea } from '@/src/web/components/catalyst/textarea';
import { Field, Label } from '@/src/web/components/catalyst/fieldset';
import { requestJoinParentAction } from '@/web/actions/joinParentRequest';
import { searchOrganizationsForJoinParentAction } from '@/web/actions/organization';

interface JoinParentFormProps {
  childOrgId: string;
  excludeIds: string[];
}

type OrgOption = { id: string; name: string };

export function JoinParentForm({
  childOrgId,
  excludeIds,
}: JoinParentFormProps) {
  const t = useTranslations('organization.joinParent');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[]> | undefined
  >();

  const [selected, setSelected] = useState<OrgOption | null>(null);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<OrgOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setOptions([]);
        setIsSearching(false);

        return;
      }

      setIsSearching(true);

      try {
        const result = await searchOrganizationsForJoinParentAction(
          q,
          excludeIds
        );

        if (result.success) {
          setOptions(result.data);
        }
      } finally {
        setIsSearching(false);
      }
    },
    [excludeIds]
  );

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setOptions([]);

      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(() => {
      search(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, search]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setFieldErrors(undefined);

    const formData = new FormData(event.currentTarget);
    formData.append('childOrgId', childOrgId);

    const result = await requestJoinParentAction(formData);

    if (result.success) {
      setIsSubmitting(false);
      router.back();
    } else {
      setError(result.error);
      setFieldErrors(result.fieldErrors);
      setIsSubmitting(false);
    }
  };

  // Styling classes matching Catalyst combobox
  const controlClasses = clsx(
    'relative block w-full',
    'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm',
    'dark:before:hidden',
    'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-brand-green',
    'has-data-disabled:opacity-50 has-data-disabled:before:bg-zinc-950/5 has-data-disabled:before:shadow-none'
  );

  const inputClasses = clsx(
    'relative block w-full appearance-none rounded-lg py-[calc(--spacing(2.5)-1px)] sm:py-[calc(--spacing(1.5)-1px)]',
    'pr-[calc(--spacing(10)-1px)] pl-[calc(--spacing(3.5)-1px)] sm:pr-[calc(--spacing(9)-1px)] sm:pl-[calc(--spacing(3)-1px)]',
    'text-base/6 text-zinc-950 placeholder:text-zinc-500 sm:text-sm/6 dark:text-white',
    'border border-zinc-950/10 data-hover:border-zinc-950/20 dark:border-white/10 dark:data-hover:border-white/20',
    'bg-transparent dark:bg-white/5',
    'focus:outline-hidden'
  );

  const optionsClasses = clsx(
    '[--anchor-gap:--spacing(2)] [--anchor-padding:--spacing(4)] sm:data-[anchor~=start]:[--anchor-offset:-4px]',
    'isolate min-w-[calc(var(--input-width)+8px)] scroll-py-1 rounded-xl p-1 select-none empty:invisible',
    'outline outline-transparent focus:outline-hidden',
    'overflow-y-scroll overscroll-contain',
    'bg-white/75 backdrop-blur-xl dark:bg-zinc-800/75',
    'shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10 dark:ring-inset',
    'transition-opacity duration-100 ease-in data-closed:data-leave:opacity-0 data-transition:pointer-events-none'
  );

  const optionClasses = clsx(
    'group/option grid w-full cursor-pointer grid-cols-[1fr_--spacing(5)] items-baseline gap-x-2 rounded-lg py-2.5 pr-2 pl-3.5 sm:grid-cols-[1fr_--spacing(4)] sm:py-1.5 sm:pr-2 sm:pl-3',
    'text-base/6 text-zinc-950 sm:text-sm/6 dark:text-white forced-colors:text-[CanvasText]',
    'outline-hidden data-focus:bg-brand-green data-focus:text-white',
    'forced-color-adjust-none forced-colors:data-focus:bg-[Highlight] forced-colors:data-focus:text-[HighlightText]'
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && !fieldErrors && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/10">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <Field>
        <Label>{t('selectParent')}</Label>
        <Headless.Combobox
          value={selected}
          onChange={(val) => {
            setSelected(val);
            setQuery('');
          }}
          disabled={isSubmitting}
        >
          <span data-slot="control" className={controlClasses}>
            <Headless.ComboboxInput
              data-slot="control"
              displayValue={(org: OrgOption | null) => org?.name ?? ''}
              onChange={(e) => setQuery(e.target.value)}
              // WORKAROUND: Headless UI intercepts Home/End to navigate options.
              // Remove once https://github.com/tailwindlabs/headlessui/commit/433b174 lands in a stable release.
              onKeyDown={(e) => {
                if ((e.key === 'Home' || e.key === 'End') && !e.shiftKey) {
                  e.preventDefault();
                  const input = e.currentTarget;
                  const pos = e.key === 'Home' ? 0 : input.value.length;
                  input.setSelectionRange(pos, pos);
                }
              }}
              placeholder={t('typeToSearch')}
              className={inputClasses}
            />
            <Headless.ComboboxButton className="group absolute inset-y-0 right-0 flex items-center px-2">
              <svg
                className="size-5 stroke-zinc-500 group-data-disabled:stroke-zinc-600 group-data-hover:stroke-zinc-700 sm:size-4 dark:stroke-zinc-400 dark:group-data-hover:stroke-zinc-300 forced-colors:stroke-[CanvasText]"
                viewBox="0 0 16 16"
                aria-hidden="true"
                fill="none"
              >
                <path
                  d="M5.75 10.75L8 13L10.25 10.75"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10.25 5.25L8 3L5.75 5.25"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Headless.ComboboxButton>
          </span>
          <Headless.ComboboxOptions
            anchor="bottom"
            transition
            className={optionsClasses}
          >
            {isSearching && (
              <div className="px-3.5 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                {t('searchingOrgs')}
              </div>
            )}
            {!isSearching && query.trim() && options.length === 0 && (
              <div className="px-3.5 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                {t('noResultsFound')}
              </div>
            )}
            {options.map((org) => (
              <Headless.ComboboxOption
                key={org.id}
                value={org}
                className={optionClasses}
              >
                <span className="flex min-w-0 items-center">
                  <span className="truncate">{org.name}</span>
                </span>
                <svg
                  className="relative col-start-2 hidden size-5 self-center stroke-current group-data-selected/option:inline sm:size-4"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 8.5l3 3L12 4"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Headless.ComboboxOption>
            ))}
          </Headless.ComboboxOptions>
        </Headless.Combobox>
        {/* Hidden input for form submission */}
        <input type="hidden" name="parentOrgId" value={selected?.id ?? ''} />
      </Field>

      <Field>
        <Label htmlFor="message">{t('message')}</Label>
        <Textarea
          id="message"
          name="message"
          rows={4}
          placeholder={t('messagePlaceholder')}
          required
          invalid={!!fieldErrors?.message}
          onChange={() => setFieldErrors(undefined)}
          disabled={isSubmitting}
        />
        {fieldErrors?.message && (
          <p className="text-sm text-red-600">{fieldErrors.message[0]}</p>
        )}
      </Field>

      <div className="flex flex-wrap gap-4">
        <Button
          type="button"
          plain
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          {tCommon('cancel')}
        </Button>
        <Button
          type="submit"
          color="brand-green"
          disabled={isSubmitting || !selected}
        >
          {isSubmitting ? t('submitting') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
