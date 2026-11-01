# Environment setup

Create a root-level .env.local file for the Next.js application:

~~~env
MONGODB_URI=mongodb://127.0.0.1:27017/appointment_ai
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=replace-with-a-long-random-secret
GEMINI_API_KEY=replace-with-your-gemini-api-key
~~~

Use a MongoDB Atlas URI instead of the local URI when appropriate. Generate a random authentication secret with:

~~~bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
~~~

The authentication configuration accepts AUTH_SECRET or NEXTAUTH_SECRET. Never commit .env.local, MongoDB credentials, authentication secrets, or API keys.

## Seed scripts

The standalone seed scripts use dotenv. Set MONGODB_URI in the shell before running them, or put it in a root .env file. A .env.local file is loaded by Next.js but is not automatically loaded by dotenv/config in these scripts.

Create an administrator with your own local credentials:

PowerShell:

~~~powershell
$env:MONGODB_URI = "mongodb://127.0.0.1:27017/appointment_ai"
$env:ADMIN_EMAIL = "admin@clinicai.test"
$env:ADMIN_PASSWORD = "choose-a-strong-local-password"
$env:ADMIN_NAME = "Clinic Admin"
npm run seed:admin
~~~

Bash or zsh:

~~~bash
export MONGODB_URI="mongodb://127.0.0.1:27017/appointment_ai"
export ADMIN_EMAIL="admin@clinicai.test"
export ADMIN_PASSWORD="choose-a-strong-local-password"
export ADMIN_NAME="Clinic Admin"
npm run seed:admin
~~~

Then seed doctors, specialties, and demo patients:

~~~bash
npm run seed:data
~~~

Seeded patient demo accounts use password patient123. Do not use demo credentials in a deployed environment. For full setup instructions, see [SETUP.md](SETUP.md).
