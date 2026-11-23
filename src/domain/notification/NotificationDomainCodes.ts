/** Stable notification validation failures are localized by inbound adapters. */
export const NotificationDomainCodes = {
  INVALID_DATA: 'domain.notification.invalidData',
} as const;
export type NotificationDomainCode =
  (typeof NotificationDomainCodes)[keyof typeof NotificationDomainCodes];
