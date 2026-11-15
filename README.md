# ClinicAI

ClinicAI is a clinic appointment and operations platform. Patients can find doctors, check availability, book and manage appointments, and ask an AI assistant for help navigating the clinic. Administrators manage clinic operations, maintain the assistant's approved knowledge, and review data-backed reports.

## Main features

### Patient portal
- Register and sign in as a patient.
- Browse active doctors and specialties, view schedules, and book available appointments.
- View, cancel, or manage appointments, including appointments affected by a doctor's leave.
- Chat with ClinicAI in Arabic, English, or French. The assistant can find clinic specialties, doctors, availability, and answers from approved clinic information.
- Confirm bookings and cancellation requests explicitly; the assistant does not make those changes without patient confirmation.

### Administration
- Manage doctors, specialties, patient records, clinic hours, and appointments.
- Record doctor leave and review affected appointments.
- Use the admin dashboard and date-range reports, and export appointment data as CSV.
- Search clinic records.
- Add or import AI knowledge as drafts, test it, review versions, and publish approved content.

## Technology

- Next.js App Router, React, and TypeScript
- MongoDB with Mongoose
- NextAuth credentials authentication with patient/admin roles
- Gemini for the patient assistant
- Tailwind CSS

## Requirements

- Node.js 20.16+ or 22.3+
- MongoDB local or MongoDB Atlas
- A Gemini API key for AI chat and assistant testing

## Local setup

1. Install dependencies:

~~~bash
npm install
~~~

2. Create a root-level .env.local file:

~~~env
MONGODB_URI=mongodb://127.0.0.1:27017/appointment_ai
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=replace-with-a-long-random-secret
GEMINI_API_KEY=replace-with-your-gemini-api-key
CRON_SECRET=replace-with-a-long-random-secret
~~~

Generate a secret with:

~~~bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
~~~

Never commit .env.local or real credentials.

3. Seed an administrator and demo clinic data. The seed scripts need MONGODB_URI in the shell environment (or in a root .env file); dotenv does not automatically load .env.local for these standalone scripts.

PowerShell:

~~~powershell
$env:MONGODB_URI = "mongodb://127.0.0.1:27017/appointment_ai"
$env:ADMIN_EMAIL = "admin@clinicai.test"
$env:ADMIN_PASSWORD = "choose-a-strong-local-password"
$env:ADMIN_NAME = "Clinic Admin"
npm run seed:admin
npm run seed:data
~~~

Bash or zsh:

~~~bash
export MONGODB_URI="mongodb://127.0.0.1:27017/appointment_ai"
export ADMIN_EMAIL="admin@clinicai.test"
export ADMIN_PASSWORD="choose-a-strong-local-password"
export ADMIN_NAME="Clinic Admin"
npm run seed:admin
npm run seed:data
~~~

The administrator is created from the values you provide. There is no shared administrator password in the repository. Public registration always creates a patient account.

4. Start the development server:

~~~bash
npm run dev
~~~

Open http://localhost:3000. Sign in as the administrator at /auth/login to use /admin/dashboard.

On Vercel Pro or Enterprise, pending appointment requests are checked every minute. Requests still pending when their scheduled start time passes are cancelled with a reason, and the patient and administrators receive in-app notifications. Set `CRON_SECRET` in the Vercel project's production environment variables to a long random value; Vercel sends it to the protected cron route automatically. The scheduled job runs on production deployments, not with `npm run dev`. Vercel Hobby only supports daily cron execution, so this minute-by-minute configuration requires a minute-level scheduler plan or another scheduler.

During local development, `npm run dev` starts a development-only check immediately and then every minute. It uses the configured database and does not require calling the cron route manually. Restart the dev server after adding this instrumentation.

For an optional manual one-off run, set `CRON_SECRET` in `.env.local` and restart the dev server. Then put the same local value in your PowerShell session before calling the route:

~~~powershell
$env:CRON_SECRET = "replace-with-the-same-local-secret"
$cronHeaders = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Method Get -Uri "http://localhost:3000/api/cron/expire-pending-appointments" -Headers $cronHeaders
~~~

## Demo patient account

After running the data seed, use:

- Email: hajar789@patient.test
- Password: patient123

The seed script also creates other demo patients with the same password. These accounts are for local demonstrations only; do not use them in a deployed environment.

## AI knowledge and safety

Administrators can add FAQs or import supported PDF, TXT, and JSON files as drafts. Review and test drafts before publishing them. Patient chat only searches approved, published knowledge. Retrieval currently uses keyword matching rather than semantic embeddings.

ClinicAI helps with clinic navigation and appointment routing. It is not a medical professional and must not diagnose or prescribe treatment. See [AI_TRAINING.md](AI_TRAINING.md) for upload limits, publishing, and assistant testing details.

## Useful routes

| Area | Route |
| --- | --- |
| Sign in | /auth/login |
| Patient registration | /auth/register |
| Patient dashboard | / |
| Doctor directory | /doctors |
| Patient appointments | /appointments |
| AI assistant | /ai-chat |
| Admin dashboard | /admin/dashboard |
| Admin reports | /admin/reports |
| AI knowledge management | /admin/ai-training |

## Development commands

~~~bash
npm run dev       # Start the development server
npm test          # Run unit and AI workflow tests
npm run lint      # Run ESLint
npm run build     # Build the production app
npm run seed:admin
npm run seed:data
~~~

For detailed environment and authentication notes, see [SETUP.md](SETUP.md), [ENV_SETUP.md](ENV_SETUP.md), and [AUTHENTICATION.md](AUTHENTICATION.md).
