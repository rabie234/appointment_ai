# Authentication and access control

ClinicAI has two account roles: patient and admin. Authentication uses NextAuth credentials, MongoDB/Mongoose, bcrypt password hashing, and JWT sessions.

## Patient registration

- The public registration page creates patient accounts only.
- The role is set on the server; a role sent by the browser or API request is ignored.
- Passwords are hashed by the User model before saving.
- After registration, the patient is signed in and redirected to the patient area.

Do not create an administrator through public registration or by sending role: admin to the registration endpoint.

## Administrator provisioning

Create an administrator locally with the seed script:

~~~bash
ADMIN_EMAIL=admin@clinicai.test ADMIN_PASSWORD=your-strong-password ADMIN_NAME="Clinic Admin" npm run seed:admin
~~~

The script creates or promotes the account matching ADMIN_EMAIL. See [SETUP.md](SETUP.md) for PowerShell, Bash, MongoDB, and demo-data setup instructions. The repository does not provide a shared admin password.

## Sessions and route protection

- NextAuth uses a JWT session and stores the user's id and role in the session.
- src/proxy.ts handles the initial route checks. It uses an Edge-safe auth configuration.
- Server pages and server actions also check roles with src/lib/session.ts. This is important because server actions must enforce authorization themselves.
- Signed-out users are redirected to /auth/login.
- Patients can use patient routes; administrators can use /admin/*.
- Public registration and login routes remain available to signed-out users.

## Main authentication files

- src/lib/auth.ts — credentials provider and database-backed sign-in
- src/lib/auth.config.ts — Edge-safe JWT and session callbacks
- src/lib/roles.ts — role-to-route rules
- src/lib/session.ts — server-side session and role guards
- src/proxy.ts — route protection
- src/app/auth/actions.ts — login and patient registration actions
- src/app/api/auth/register/route.ts — patient registration endpoint
- src/models/User.ts — user schema and password hashing

## Local verification

1. Create an administrator with the seed script and demo patients with npm run seed:data.
2. Sign in as an administrator and confirm /admin/dashboard is available.
3. Register or use a seeded patient account and confirm patient pages are available.
4. Confirm a patient cannot access /admin/* and a signed-out user is redirected to sign-in.

For environment variables and setup steps, see [ENV_SETUP.md](ENV_SETUP.md) and [SETUP.md](SETUP.md).
