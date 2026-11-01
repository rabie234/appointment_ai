# ClinicAI setup guide

This guide covers local development setup for the full ClinicAI application. For the overview and demo patient account, see [README.md](README.md).

## Requirements

- Node.js 20.16+ or 22.3+
- npm
- MongoDB running locally or a MongoDB Atlas connection
- A Gemini API key for AI chat and assistant testing

## 1. Install dependencies

~~~bash
npm install
~~~

## 2. Configure the application

Create a root-level .env.local file:

~~~env
MONGODB_URI=mongodb://127.0.0.1:27017/appointment_ai
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=replace-with-a-long-random-secret
GEMINI_API_KEY=replace-with-your-gemini-api-key
~~~

Generate a random authentication secret with:

~~~bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
~~~

AUTH_SECRET is preferred by the current configuration; NEXTAUTH_SECRET is also accepted. Keep all secrets out of version control.

The application reads .env.local. The standalone seed scripts use dotenv and need MONGODB_URI from the shell environment or a root .env file. The examples below set it in the shell.

## 3. Create a local administrator

Public registration creates patient accounts only. Do not try to create an administrator by passing role: admin to the registration API; the submitted role is intentionally ignored.

Set the values for a local admin account and run the seed script.

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

The script creates the administrator, or promotes the account with that email to admin and resets its password. Use a strong password and keep it private.

## 4. Add demo clinic data

In the same shell session where MONGODB_URI is set, run:

~~~bash
npm run seed:data
~~~

This seeds specialties, doctors, and demo patients. The seeded patient accounts use password patient123; the primary demo account is hajar789@patient.test. These are local demo credentials only.

## 5. Start the application

~~~bash
npm run dev
~~~

Open http://localhost:3000. Sign in at /auth/login. Patient pages require a patient account; /admin/* requires an administrator account.

## 6. Try the main workflows

- As a patient: browse doctors, check available times, book an appointment, review appointments, and try the AI assistant.
- As an administrator: manage doctors and clinic hours, review and update appointments, record doctor leave, inspect reports, and export appointments as CSV.
- In AI Training: add or import knowledge, test it as a draft, then publish approved entries.

A Gemini API key is required for AI chat and assistant tests. MongoDB is required for application data, knowledge entries, and AI metrics.

## Verification commands

~~~bash
npm test
npm run lint
npm run build
~~~

The test suite includes unit tests and AI workflow tests. See [AI_TRAINING.md](AI_TRAINING.md) for details about training data, limits, retrieval behavior, and test mode.
