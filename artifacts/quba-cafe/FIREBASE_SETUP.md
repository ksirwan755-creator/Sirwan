# Firebase setup

QUBA uses Firebase Authentication with email/password and Cloud Firestore. It
does not create accounts, use sample records, or require a service-account key.
The Firebase web configuration is public client configuration; do not put a
service-account key in the app.

## Configure the app

The required Replit variables are `VITE_FIREBASE_API_KEY`,
`VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`,
and `VITE_CAFE_OWNER_UID`. The first four come from Firebase Console → Project
settings → General → Your apps → the Web app configuration. The owner UID comes
from Firebase Console → Authentication → Users. `VITE_FIREBASE_STORAGE_BUCKET`,
`VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_MEASUREMENT_ID` are
optional.

On a phone, open the Replit project, tap ☰ → Tools → Secrets → + New Secret.
Enter each exact variable name and its value, then save. Restart the web
workflow after changing the values. Firebase web-app settings are client
configuration; never use a service-account key or share an account password.

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
