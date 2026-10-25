# Privacy enforcement

Goal - do not expose our users' private data (phone number, name) unless:

- they gave us the permission
- their role assumes exposing their name (as an org admin)

Ok to show users' names within the organization (in boards, org's lists, etc).
Every member of an org is allowed to know all its boards' members' names and its admins' names.

## Privacy section

Our account page should have a privacy section: http://localhost:8080/en/account

It should state that by creating an organization, you become its admin, and agree to expose your name
to the users of our portal.
If you become an admin of some other organization - same thing.
If you become a member of an org or org's board - that org's members will be able to see your name.

Also, it should have 2 toggles:

- allow/disallow to find me by name when a search is made to invite to be an admin or board member of an org I am not a member of
- allow/disallow to find me by my phone number when a search is made to invite to be an admin or board member of an org I am not a member of

These 2 rules should be abided by when we those searches are run.

- http://localhost:8080/en/organizations/cmmatod1i00golsijlzvqfrlb/modify
- http://localhost:8080/en/organizations/cmmatod1i00golsijlzvqfrlb/boards/cmmatody601y2lsij66l8rg0k/manage

## Phone number hiding

- do not expose users' phone numbers anywhere: in search results, PDFs, etc
- they should not even be in responses of nextjs requests or api requests
- and of course - they should not be anywhere in the UI (other than the account page of a user)

## Seach improvements

Phone:

- only allow a search by phone when the whole phone is filled in, not a fuzzy search like now
- before returning a user whose phone is entered - we need to check that user's privacy settings
- in order to prevent someone abusing our system (enumerating/listing phone numbers) - let's limit the number of search requests by a phone number per ip address
  - we already have a general rate limiter - look at it as example

Name:

- before returning a user whose name is entered - we need to check that user's privacy settings

Let's discuss what else needs to be implemented as part of this plan.

## Plan feedback 1

### Phone search

I think search by phone should have its own element:

- a user fills in the phone, clicks "Find" and gets or not get a user
- only clicking "Find" initiates the search (and counts towards the misses if not found)
- this eliminates a need for phone regex to tell apart phone vs name/nickname search

### Privacy changes

I think we need to save all occurences when a user changes their privacy settings. Otherwise, someone could try to blame us for showing them in search results by phone, for example, within a period when they let us do it, but later they opt out of it. Should we have a separate table for this and whenever we change the privacy - do it in a db transaction: update user settings + insert a record with timestamp?
