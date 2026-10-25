# Top Navigation Bar Implementation

## Overview

Add responsive top navbar using Catalyst's `StackedLayout` + `Navbar`. Applies to all authenticated pages.

## Navbar Structure

| Left                               | Right                       |
| ---------------------------------- | --------------------------- |
| "Resolutio" (text, links to /home) | Account (links to /account) |
| Organizations                      | LocaleSwitcher              |
| Polls                              |                             |
| Admin (superadmin only)            |                             |

---

## Phase 1: Localization Keys

- [x] Add `navbar` section to `messages/en.json` and `messages/ru.json`
- Keys: `logo`, `organizations`, `polls`, `admin`, `account`

## Phase 2: Tests (TDD)

- [x] Create `src/web/components/__tests__/AppNavbar.test.tsx`
  - Renders logo linking to /home
  - Renders Organizations, Polls, Account links
  - Shows Admin link only when isSuperAdmin=true
  - Marks correct item as current based on path
- [x] Create `src/web/components/__tests__/MobileSidebar.test.tsx`
  - Similar tests for mobile sidebar

## Phase 3: Create Navbar Components

- [x] `src/web/components/AppNavbar.tsx` - Desktop navbar
  - Uses `Navbar`, `NavbarItem`, `NavbarSection`, `NavbarSpacer`
  - Props: `isSuperAdmin: boolean`
  - Uses `usePathname()` for active state
  - Icons: Organizations (building), Polls (chart), Admin (shield), Account (user)
- [x] `src/web/components/MobileSidebar.tsx` - Mobile drawer
  - Uses `Sidebar`, `SidebarItem`, `SidebarSection`
  - Same props, logic, and icons as AppNavbar
- [x] Update `src/web/components/LocaleSwitcher.tsx` - Restyle to match navbar items

## Phase 4: Create AuthenticatedLayout

- [x] `src/web/components/AuthenticatedLayout.tsx`
  - Server component wrapper
  - Gets user session, checks superadmin status
  - Renders `StackedLayout` with navbar + sidebar

## Phase 5: Apply Layout to Pages

- [x] `/home/page.tsx` - wrap, remove: Account btn, Browse Orgs btn, View Polls btn
- [x] `/organizations/page.tsx` - wrap, remove: Back btn, Account btn
- [x] `/organizations/[id]/page.tsx` - wrap, remove: Back btn, Account btn
- [x] `/organizations/pending-requests/page.tsx` - wrap, remove: Back btn, Account btn
- [x] `/polls/page.tsx` - wrap
- [x] `/polls/create/page.tsx` - wrap
- [x] `/polls/[pollId]/edit/page.tsx` - wrap (keep Cancel btn)
- [x] `/polls/[pollId]/vote/page.tsx` - wrap
- [x] `/polls/[pollId]/results/page.tsx` - wrap
- [x] `/polls/[pollId]/participants/page.tsx` - wrap
- [x] `/account/page.tsx` - wrap

## Phase 6: Verify

- [ ] Test navbar renders on all authenticated pages
- [ ] Test mobile hamburger menu works
- [ ] Test active states highlight correctly
- [ ] Test superadmin sees Admin link, regular users don't
- [ ] Test LocaleSwitcher works in navbar

---

## Critical Files

- `src/app/components/catalyst/stacked-layout.tsx`
- `src/app/components/catalyst/navbar.tsx`
- `src/web/lib/session.ts` - getCurrentUser()
- `src/infrastructure/repositories/PrismaUserRepository.ts` - isSuperAdmin()

---

## Unresolved Questions

None
