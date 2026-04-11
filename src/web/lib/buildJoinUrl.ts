import { slugifyOrgName } from './orgSlug';

export function buildJoinUrl(orgName: string, token: string): string {
  return `/join/${slugifyOrgName(orgName)}/${token}`;
}
