export type SortDirection = 'asc' | 'desc';

export type MemberSortField = 'name' | 'joinedAt';

export interface MemberSortable {
  name: string;
  joinedAt?: Date;
}

const compareStrings = (
  a: string,
  b: string,
  locale: string,
  direction: SortDirection
): number => {
  const result = a.localeCompare(b, locale);

  return direction === 'asc' ? result : -result;
};

const compareDates = (
  a: Date | undefined,
  b: Date | undefined,
  direction: SortDirection
): number => {
  const aTime = a ? a.getTime() : 0;
  const bTime = b ? b.getTime() : 0;
  const result = aTime - bTime;

  return direction === 'asc' ? result : -result;
};

export type AdminSortField = 'name';

export interface AdminSortable {
  name: string;
}

export function sortAdminOrganizations<T extends AdminSortable>(
  list: T[],
  sort: { field: AdminSortField; direction: SortDirection },
  locale: string
): T[] {
  const copy = [...list];
  copy.sort((a, b) => compareStrings(a.name, b.name, locale, sort.direction));

  return copy;
}

export type ExternalBoardSortField = 'name' | 'organizationName';

export interface ExternalBoardSortable {
  name: string;
  organizationName: string;
}

export function sortExternalBoards<T extends ExternalBoardSortable>(
  list: T[],
  sort: { field: ExternalBoardSortField; direction: SortDirection },
  locale: string
): T[] {
  const copy = [...list];
  const key: keyof ExternalBoardSortable = sort.field;
  copy.sort((a, b) => compareStrings(a[key], b[key], locale, sort.direction));

  return copy;
}

export function sortMemberOrganizations<T extends MemberSortable>(
  list: T[],
  sort: { field: MemberSortField; direction: SortDirection },
  locale: string
): T[] {
  const copy = [...list];

  if (sort.field === 'name') {
    copy.sort((a, b) => compareStrings(a.name, b.name, locale, sort.direction));
  } else {
    copy.sort((a, b) => compareDates(a.joinedAt, b.joinedAt, sort.direction));
  }

  return copy;
}
