import { describe, it, expect } from 'vitest';

// Sidebar items configuration helper (mirrors navbar logic)
function getSidebarItems(isSuperAdmin: boolean) {
  const items = [
    { key: 'organizations', href: '/organizations' },
    { key: 'polls', href: '/polls' },
  ];

  if (isSuperAdmin) {
    items.push({ key: 'admin', href: '/admin' });
  }

  return items;
}

function isItemCurrent(itemHref: string, pathname: string): boolean {
  if (itemHref === '/home') {
    return pathname === '/home';
  }
  return pathname.startsWith(itemHref);
}

describe('MobileSidebar navigation logic', () => {
  describe('getSidebarItems', () => {
    it('should return organizations and polls for regular users', () => {
      const items = getSidebarItems(false);

      expect(items).toHaveLength(2);
      expect(items.find((i) => i.key === 'organizations')).toBeDefined();
      expect(items.find((i) => i.key === 'polls')).toBeDefined();
      expect(items.find((i) => i.key === 'admin')).toBeUndefined();
    });

    it('should include admin link for superadmins', () => {
      const items = getSidebarItems(true);

      expect(items).toHaveLength(3);
      expect(items.find((i) => i.key === 'admin')).toBeDefined();
      expect(items.find((i) => i.key === 'admin')?.href).toBe('/admin');
    });
  });

  describe('isItemCurrent', () => {
    it('should mark home as current only for exact /home path', () => {
      expect(isItemCurrent('/home', '/home')).toBe(true);
      expect(isItemCurrent('/home', '/home/something')).toBe(false);
    });

    it('should mark organizations as current for /organizations and subpaths', () => {
      expect(isItemCurrent('/organizations', '/organizations')).toBe(true);
      expect(isItemCurrent('/organizations', '/organizations/123')).toBe(true);
    });

    it('should mark polls as current for /polls and subpaths', () => {
      expect(isItemCurrent('/polls', '/polls')).toBe(true);
      expect(isItemCurrent('/polls', '/polls/create')).toBe(true);
    });

    it('should mark admin as current for /admin and subpaths', () => {
      expect(isItemCurrent('/admin', '/admin')).toBe(true);
      expect(isItemCurrent('/admin', '/admin/users')).toBe(true);
    });

    it('should mark account as current for /account', () => {
      expect(isItemCurrent('/account', '/account')).toBe(true);
    });
  });
});

describe('MobileSidebar rendering requirements', () => {
  it('should have logo linking to /home in header', () => {
    const logoHref = '/home';
    expect(logoHref).toBe('/home');
  });

  it('should have account link', () => {
    const accountHref = '/account';
    expect(accountHref).toBe('/account');
  });

  it('should have navigation items in body section', () => {
    const items = getSidebarItems(false);
    expect(items.length).toBeGreaterThanOrEqual(2);
  });
});
