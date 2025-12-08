import clsx from 'clsx'
import type React from 'react'

const colors = {
  red: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800',
  green: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800',
  yellow: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-200 dark:border-yellow-800',
  blue: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-800',
}

export function AlertBanner({
  color = 'blue',
  className,
  children,
  ...props
}: {
  color?: keyof typeof colors
  className?: string
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      role="alert"
      className={clsx(
        'rounded-lg border px-4 py-3 text-sm',
        colors[color],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
