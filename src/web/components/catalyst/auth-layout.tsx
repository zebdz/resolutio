import type React from 'react';
import { LocaleSwitcher } from '@/src/web/components/layout/LocaleSwitcher';
import { getVersion } from '@/src/web/lib/version';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col p-2">
      <div className="absolute top-6 right-6 z-10">
        <LocaleSwitcher />
      </div>
      <div className="flex grow items-center justify-center p-6 lg:rounded-lg lg:bg-white lg:p-10 lg:shadow-xs lg:ring-1 lg:ring-zinc-950/5 dark:lg:bg-zinc-900 dark:lg:ring-white/10">
        {children}
      </div>
      <footer className="py-2 text-center text-xs text-zinc-400">
        {getVersion()}
      </footer>
    </main>
  );
}
