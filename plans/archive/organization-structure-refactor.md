## Organization structure / user join / voting refactor

### Current behavior:

- it('should fail if user is member of parent organization', async () => {
- it('should fail if user is member of child organization', async () => {
- So, a user can only be a member of one organization in the hierarchy of organizations
  JoinOrganizationUseCase:
  // Check hierarchy constraints
  // Get all ancestors of this organization
  const ancestorIds =
  await this.deps.organizationRepository.getAncestorIds(organizationId);
  // Get all descendants of this organization
  const descendantIds =
  await this.deps.organizationRepository.getDescendantIds(organizationId);
  // All related organizations in the hierarchy
  const hierarchyIds = [organizationId, ...ancestorIds, ...descendantIds];

  // Check if user is a member of any organization in this hierarchy
  const userOrganizations =
  await this.deps.organizationRepository.findMembershipsByUserId(userId);

  for (const userOrg of userOrganizations) {
  if (hierarchyIds.includes(userOrg.id)) {
  return failure(OrganizationErrors.HIERARCHY_CONFLICT);
  }
  }

- it('should automatically add accepted user to general board', async () => {
  ...
  So, when a user is accepted to an organization, they join the general board of that organization.

- When adding a user to a board, right now the list contains only organization users

### Needed behavior:

- A user can only be a member of one organization in the hierarchy of organizations - that stays
- A user should be allowed to join any organization (child or parent in the hierarchy). However, when they join an organization of the hierarchy, they are auro-removed
  from other organizations in this hierarchy
- When a general board of a parent organization votes, it needs to include the members of all child organizations' general boards (and their childs recursively)
  How do we solve this? Do we just add a user automatically to the general board of all parent organizations at join time? Or do we dynamically query all children organizations's general boards
  when we create a snapshot of users that are allowed to vote?
- When adding a user to a board, we need to show all members of current organization + all child organizations' members
- So, really, we need to check every place where there is logic "is user member of organization x"?
  With new behavior we need to answer "Yes" to this question if a user is a member of current organization or any of its children
