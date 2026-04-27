import { describe, it, expect } from 'vitest';
import {
  sortMemberOrganizations,
  sortAdminOrganizations,
  sortExternalBoards,
} from '../sortOrganizations';

const make = (name: string, joinedAt: Date, id = name.toLowerCase()) => ({
  id,
  name,
  description: '',
  joinedAt,
});

describe('sortMemberOrganizations', () => {
  it('sorts by name asc', () => {
    const list = [
      make('Charlie', new Date('2020-01-01')),
      make('Alpha', new Date('2020-01-01')),
      make('Bravo', new Date('2020-01-01')),
    ];
    const sorted = sortMemberOrganizations(
      list,
      { field: 'name', direction: 'asc' },
      'en'
    );
    expect(sorted.map((o) => o.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('sorts by name desc', () => {
    const list = [
      make('Alpha', new Date('2020-01-01')),
      make('Charlie', new Date('2020-01-01')),
    ];
    const sorted = sortMemberOrganizations(
      list,
      { field: 'name', direction: 'desc' },
      'en'
    );
    expect(sorted.map((o) => o.name)).toEqual(['Charlie', 'Alpha']);
  });

  it('sorts by joinedAt asc (oldest first)', () => {
    const list = [
      make('A', new Date('2022-01-01')),
      make('B', new Date('2020-01-01')),
      make('C', new Date('2021-01-01')),
    ];
    const sorted = sortMemberOrganizations(
      list,
      { field: 'joinedAt', direction: 'asc' },
      'en'
    );
    expect(sorted.map((o) => o.name)).toEqual(['B', 'C', 'A']);
  });

  it('sorts by joinedAt desc (newest first)', () => {
    const list = [
      make('A', new Date('2020-01-01')),
      make('B', new Date('2022-01-01')),
      make('C', new Date('2021-01-01')),
    ];
    const sorted = sortMemberOrganizations(
      list,
      { field: 'joinedAt', direction: 'desc' },
      'en'
    );
    expect(sorted.map((o) => o.name)).toEqual(['B', 'C', 'A']);
  });

  it('uses locale-aware comparison for Cyrillic', () => {
    const list = [
      make('Яблоко', new Date('2020-01-01')),
      make('Апельсин', new Date('2020-01-01')),
      make('Банан', new Date('2020-01-01')),
    ];
    const sorted = sortMemberOrganizations(
      list,
      { field: 'name', direction: 'asc' },
      'ru'
    );
    expect(sorted.map((o) => o.name)).toEqual(['Апельсин', 'Банан', 'Яблоко']);
  });

  it('does not mutate the input list', () => {
    const list = [
      make('B', new Date('2020-01-01')),
      make('A', new Date('2020-01-01')),
    ];
    const before = list.map((o) => o.name);
    sortMemberOrganizations(list, { field: 'name', direction: 'asc' }, 'en');
    expect(list.map((o) => o.name)).toEqual(before);
  });

  it('preserves insertion order for equal-name items (stable)', () => {
    const list = [
      make('Same', new Date('2020-01-01'), 'first'),
      make('Same', new Date('2020-01-01'), 'second'),
      make('Same', new Date('2020-01-01'), 'third'),
    ];
    const sorted = sortMemberOrganizations(
      list,
      { field: 'name', direction: 'asc' },
      'en'
    );
    expect(sorted.map((o) => o.id)).toEqual(['first', 'second', 'third']);
  });
});

describe('sortAdminOrganizations', () => {
  it('sorts by name asc', () => {
    const list = [
      { id: '1', name: 'Beta', description: '' },
      { id: '2', name: 'Alpha', description: '' },
    ];
    const sorted = sortAdminOrganizations(
      list,
      { field: 'name', direction: 'asc' },
      'en'
    );
    expect(sorted.map((o) => o.name)).toEqual(['Alpha', 'Beta']);
  });

  it('sorts by name desc', () => {
    const list = [
      { id: '1', name: 'Alpha', description: '' },
      { id: '2', name: 'Beta', description: '' },
    ];
    const sorted = sortAdminOrganizations(
      list,
      { field: 'name', direction: 'desc' },
      'en'
    );
    expect(sorted.map((o) => o.name)).toEqual(['Beta', 'Alpha']);
  });

  it('does not mutate the input list', () => {
    const list = [
      { id: '1', name: 'Beta', description: '' },
      { id: '2', name: 'Alpha', description: '' },
    ];
    const before = list.map((o) => o.name);
    sortAdminOrganizations(list, { field: 'name', direction: 'asc' }, 'en');
    expect(list.map((o) => o.name)).toEqual(before);
  });
});

describe('sortExternalBoards', () => {
  const makeBoard = (name: string, organizationName: string, id = name) => ({
    id,
    name,
    organizationId: 'org-' + organizationName,
    organizationName,
  });

  it('sorts by name asc', () => {
    const list = [makeBoard('Z-board', 'Org B'), makeBoard('A-board', 'Org A')];
    const sorted = sortExternalBoards(
      list,
      { field: 'name', direction: 'asc' },
      'en'
    );
    expect(sorted.map((b) => b.name)).toEqual(['A-board', 'Z-board']);
  });

  it('sorts by name desc', () => {
    const list = [makeBoard('A-board', 'Org A'), makeBoard('Z-board', 'Org B')];
    const sorted = sortExternalBoards(
      list,
      { field: 'name', direction: 'desc' },
      'en'
    );
    expect(sorted.map((b) => b.name)).toEqual(['Z-board', 'A-board']);
  });

  it('sorts by organizationName asc', () => {
    const list = [makeBoard('B1', 'Zulu Org'), makeBoard('B2', 'Alpha Org')];
    const sorted = sortExternalBoards(
      list,
      { field: 'organizationName', direction: 'asc' },
      'en'
    );
    expect(sorted.map((b) => b.organizationName)).toEqual([
      'Alpha Org',
      'Zulu Org',
    ]);
  });

  it('sorts by organizationName desc', () => {
    const list = [makeBoard('B1', 'Alpha Org'), makeBoard('B2', 'Zulu Org')];
    const sorted = sortExternalBoards(
      list,
      { field: 'organizationName', direction: 'desc' },
      'en'
    );
    expect(sorted.map((b) => b.organizationName)).toEqual([
      'Zulu Org',
      'Alpha Org',
    ]);
  });

  it('does not mutate the input list', () => {
    const list = [makeBoard('Z-board', 'Org B'), makeBoard('A-board', 'Org A')];
    const before = list.map((b) => b.name);
    sortExternalBoards(list, { field: 'name', direction: 'asc' }, 'en');
    expect(list.map((b) => b.name)).toEqual(before);
  });
});
