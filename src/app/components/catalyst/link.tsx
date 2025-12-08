import * as Headless from '@headlessui/react'
import React, { forwardRef } from 'react'
import { Link as IntlLink } from '@/src/i18n/routing'
import type { ComponentProps } from 'react'

export const Link = forwardRef(function Link(
  props: ComponentProps<typeof IntlLink>,
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  return <IntlLink {...props} ref={ref} />
})
