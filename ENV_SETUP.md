# Environment Variables Setup

## Required Environment Variables

Create a `.env.local` file in the root directory of your project with the following variables:

```env
# MongoDB Connection (use 127.0.0.1 instead of localhost to avoid IPv6 issues)
MONGODB_URI=mongodb://127.0.0.1:27017/appointment_ai
# Or use localhost (will be automatically converted to 127.0.0.1):
# MONGODB_URI=mongodb://localhost:27017/appointment_ai
# Or use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/appointment_ai?retryWrites=true&w=majority

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-generate-a-random-string
```

## Generate a Secure Secret

**Option 1: Using OpenSSL (Recommended)**
```bash
openssl rand -base64 32
```

**Option 2: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Option 3: Online Generator**
Visit: https://generate-secret.vercel.app/32

## Quick Setup

1. Copy the generated secret
2. Create `.env.local` file in the project root
3. Paste the secret as `NEXTAUTH_SECRET=your-generated-secret`
4. Add your MongoDB connection string
5. Restart your development server

## Example .env.local

```env
MONGODB_URI=mongodb://127.0.0.1:27017/appointment_ai
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=abc123xyz456def789ghi012jkl345mno678pqr901stu234vwx567yz890
```

**Important:** Never commit `.env.local` to version control. It's already in `.gitignore`.

## Creating an Admin Account

Admins **cannot** be created through the public signup form — `/api/auth/register`
always creates a `patient`, and ignores any `role` sent in the request body.
This is deliberate: accepting a client-supplied role would let anyone POST
`{"role":"admin"}` and grant themselves the admin panel.

Create (or promote) an admin with the seed script:

```bash
ADMIN_EMAIL=admin@clinic.com \
ADMIN_PASSWORD=your-strong-password \
ADMIN_NAME="Clinic Admin" \
npm run seed:admin
```

The script is safe to re-run: if the email already exists it promotes that user
to `admin` and resets their password.

## Roles and Routing

| Role      | Home page          | Can access                                  |
|-----------|--------------------|---------------------------------------------|
| `patient` | `/`                | `/`, `/doctors`, `/appointments`, `/ai-chat` |
| `admin`   | `/admin/dashboard` | `/admin/*`                                   |

The two areas are strictly separated — an admin visiting a patient route is
redirected to `/admin/dashboard`, and a patient visiting `/admin/*` is
redirected to `/`. Signed-out users are redirected to `/auth/login` with a
`callbackUrl` so they land on their intended page after signing in.
