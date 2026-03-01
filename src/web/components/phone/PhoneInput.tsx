'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import ReactPhoneInput from 'react-phone-input-2';
import ru from 'react-phone-input-2/lang/ru.json';
import 'react-phone-input-2/lib/style.css';
import './phone-input.css';

// Mask per country — passed to the library and used to derive placeholder text
const MASKS: Record<string, string> = {
  ru: '(...) ...-..-..',
  us: '(...) ...-....',
  gb: '.... ......',
  de: '.... .......',
  fr: '. .. .. .. ..',
};

function maskToPlaceholder(mask: string): string {
  return ' ' + mask.replace(/\./g, '0');
}

type Props = {
  name: string;
  value: string;
  onChange: (e164: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
};

export function PhoneInput({
  name,
  value,
  onChange,
  disabled = false,
  invalid = false,
  required = false,
}: Props) {
  const locale = useLocale();
  const t = useTranslations('phone');
  const [countryCode, setCountryCode] = useState('ru');
  const [dialCode, setDialCode] = useState('7');
  const [touched, setTouched] = useState(false);

  // react-phone-input-2 gives value without '+', we store with '+'
  const rawValue = value.startsWith('+') ? value.slice(1) : value;

  // Show placeholder: on initial load (library shows dial code) or when exactly dial code
  const showPlaceholder = rawValue === dialCode || (!rawValue && !touched);

  function handleChange(
    phoneValue: string,
    country: { dialCode: string; countryCode: string }
  ) {
    setTouched(true);
    setDialCode(country.dialCode);
    setCountryCode(country.countryCode);

    const e164 = phoneValue ? `+${phoneValue}` : '';
    onChange(e164);
  }

  const containerClass = [
    'react-tel-input',
    disabled ? 'disabled' : '',
    invalid ? 'invalid' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="relative">
      <ReactPhoneInput
        country="ru"
        value={rawValue}
        onChange={handleChange}
        placeholder=""
        enableSearch
        searchPlaceholder={t('searchPlaceholder')}
        searchNotFound={t('searchNotFound')}
        localization={locale === 'ru' ? ru : undefined}
        preferredCountries={['ru', 'us', 'gb', 'de', 'fr']}
        masks={MASKS}
        isValid={(value, country: { dialCode?: string }) => {
          if (!value || !country?.dialCode) {return true;}

          return value.startsWith(country.dialCode);
        }}
        disabled={disabled}
        specialLabel=""
        inputProps={{
          name,
          required,
          autoComplete: 'tel',
        }}
        containerClass={containerClass}
        copyNumbersOnly={false}
      />
      {/* Format hint — visible only when input shows just the dial code */}
      {showPlaceholder && (
        <span className="phone-input-placeholder" aria-hidden="true">
          {/* Invisible prefix matches the dial code width so hint aligns after it */}
          <span className="invisible">+{dialCode}</span>
          {maskToPlaceholder(MASKS[countryCode] || '... ... ....')}
        </span>
      )}
    </div>
  );
}
