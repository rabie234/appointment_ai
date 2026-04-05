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
