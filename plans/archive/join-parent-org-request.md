## Join parent organization request

We need to implement a feature: an organization admin should be able to make a request on behalf of their organization
to become a part of any other organization (excluding its child organizations, so that there are no cyclic depedencies).

That request should be handled by the requested organization's admins (any of them). It can be either accepted or rejected.
If accepted, the child's parentId becomes the requested organization's id. If rejected, we need to require a rejection reason
from an admin who handles that request. In either way, we need to save the following:

- child organization's admin who made a request
- parent organization's admin who handled the request (accepted or rejected)
- timestamp of creating a request
- timestamp of handling the request
- rejection reason (of rejected)

Admins of a child organization should be able to see a pending request.
Admins of a child organization should be able to cancel a pending request.
Only single request to become part of any other organization can exist: an organization cannot send multiple requests at the same time (to one
organization or different organizations - doesn't matter)

Admins of a parent organization should be able to see pending requests (to become part of their organization).
And they should be able to handle those requets (accept, reject with a reason). If reject - a rejection reason is required.

If an organization is accepted and becomes part of another organization, all organization members (including its child organization members (recursively)) should receive a notification that they've become a part of another organization. This requires a new section in our system: notifications.
A user then can open that section (like a mailbox) and see that they have an unread notification. That should be a table layout. They can open that notification. After they open it, it should have a new status - "read". And in the notifications section, we should display a number of unread notifications. There should be a button: "Mark all read" - to mark all notifications read without having to open each one individually.

Make a multiphase plan, put it into the "plans" directory.
