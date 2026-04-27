import { describe, it, expect, beforeEach } from 'vitest';
import { loadSort, saveSort } from '../sortStorage';

class FakeStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

describe('loadSort', () => {
  let storage: FakeStorage;
  beforeEach(() => {
    storage = new FakeStorage();
  });

  it('returns default when key not present', () => {
    const result = loadSort(
      storage,
      'home.sort.member',
      ['name', 'joinedAt'] as const,
      {
        field: 'name',
        direction: 'asc',
      }
    );
    expect(result).toEqual({ field: 'name', direction: 'asc' });
  });

  it('returns stored value when valid', () => {
    storage.setItem(
      'home.sort.member',
      JSON.stringify({ field: 'joinedAt', direction: 'desc' })
    );
    const result = loadSort(
      storage,
      'home.sort.member',
      ['name', 'joinedAt'] as const,
      {
        field: 'name',
        direction: 'asc',
      }
    );
    expect(result).toEqual({ field: 'joinedAt', direction: 'desc' });
  });

  it('returns default when stored field is not allowed', () => {
    storage.setItem(
      'home.sort.member',
      JSON.stringify({ field: 'rogue', direction: 'asc' })
    );
    const result = loadSort(
      storage,
      'home.sort.member',
      ['name', 'joinedAt'] as const,
      {
        field: 'name',
        direction: 'asc',
      }
    );
    expect(result).toEqual({ field: 'name', direction: 'asc' });
  });

  it('returns default when stored direction is invalid', () => {
    storage.setItem(
      'home.sort.member',
      JSON.stringify({ field: 'name', direction: 'sideways' })
    );
    const result = loadSort(
      storage,
      'home.sort.member',
      ['name', 'joinedAt'] as const,
      {
        field: 'name',
        direction: 'asc',
      }
    );
    expect(result).toEqual({ field: 'name', direction: 'asc' });
  });

  it('returns default when stored value is malformed JSON', () => {
    storage.setItem('home.sort.member', '{not-json');
    const result = loadSort(
      storage,
      'home.sort.member',
      ['name', 'joinedAt'] as const,
      {
        field: 'name',
        direction: 'asc',
      }
    );
    expect(result).toEqual({ field: 'name', direction: 'asc' });
  });
});

describe('saveSort', () => {
  it('writes JSON-stringified value to storage', () => {
    const storage = new FakeStorage();
    saveSort(storage, 'home.sort.member', {
      field: 'joinedAt',
      direction: 'desc',
    });
    expect(storage.getItem('home.sort.member')).toBe(
      JSON.stringify({ field: 'joinedAt', direction: 'desc' })
    );
  });
});
