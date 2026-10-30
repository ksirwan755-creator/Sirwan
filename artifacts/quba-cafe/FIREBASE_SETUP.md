# Firebase setup

QUBA uses Firebase Authentication with email/password and Cloud Firestore. It
does not create accounts, use sample records, or require a service-account key.
The Firebase web configuration is public client configuration; do not put a
service-account key in the app.

## Configure the app

Add the values from the Firebase project's Web app configuration as environment
variables using the names in `.env.example`. Add the owner's Firebase
Authentication UID as `VITE_CAFE_OWNER_UID`. These values are read by Vite at
startup/build time. Restart the app after changing them.

The owner must already have an account in Firebase Authentication. Enable the
Email/Password sign-in provider in the Firebase project. The app has no
registration flow and signs out any authenticated account whose UID differs
from `VITE_CAFE_OWNER_UID`.

## Apply Firestore rules

In the Firebase console, open Firestore Database → Rules and review the
project's current rules first. If this Firebase project is dedicated to QUBA,
you can replace its rules with the contents of `firestore.rules` and publish.
If other apps or data use this project, do not replace the whole ruleset:
carefully merge the QUBA owner-scoped matches while preserving those other
rules. Firestore combines matching `allow` rules, so an existing broad or
public rule can still grant access; make sure no permissive rule covers the
QUBA owner paths.

The QUBA rules allow authenticated access only to `/owners/{uid}/...` when the
signed-in UID equals that path UID; all other document paths are denied by this
ruleset. The app stores QUBA data under `/owners/{VITE_CAFE_OWNER_UID}/...`.

Do not replace these rules with test mode or public access. The rules are not
deployed automatically from this project, so the Firebase console must show the
published rules before the app can read or write data.

## Collections

The app creates records only after the owner saves them. It uses the
`categories`, `products`, `tables`, `orders`, `expenses`, `customers`, and
`settings` collections under the owner path. No sample records are inserted.
