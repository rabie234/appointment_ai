# Setup Guide - ClinicAI Authentication

## Prerequisites

1. Node.js 20+ installed
2. MongoDB installed locally or MongoDB Atlas account

## Installation Steps

### 1. Install Dependencies

Dependencies are already installed. If you need to reinstall:

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/appointment_ai
# Or use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/appointment_ai?retryWrites=true&w=majority

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-generate-a-random-string
```

**To generate a secure NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 3. Start MongoDB

**Local MongoDB:**
```bash
# On Windows (if installed as service, it should start automatically)
# Or start manually:
mongod
```

**MongoDB Atlas:**
- Use the connection string from your Atlas cluster
- Replace `username` and `password` in the connection string

### 4. Run the Development Server

```bash
npm run dev
```

### 5. Create Your First Admin User

You can create an admin user by:

1. **Using the registration page** (will create a patient by default)
2. **Or using MongoDB directly:**

```javascript
// In MongoDB shell or Compass
use appointment_ai
db.users.insertOne({
  name: "Admin User",
  email: "admin@clinicai.com",
  password: "$2a$10$...", // Hashed password (use bcrypt)
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date()
})
```

**Or create via API:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@clinicai.com",
    "password": "admin123",
    "role": "admin"
  }'
```

## Authentication Flow

### User Roles

- **patient**: Can access patient routes (`/`, `/doctors`, `/appointments`, `/ai-chat`)
- **admin**: Can access admin routes (`/admin/*`)

### Protected Routes

- **Admin routes** (`/admin/*`): Require admin role
- **Patient routes**: Require authentication (except home page)
- **Auth routes** (`/auth/*`): Redirect to dashboard if already logged in

### API Routes

- `POST /api/auth/register` - Register a new user
- `GET/POST /api/auth/[...nextauth]` - NextAuth endpoints (login, logout, session)

## Testing Authentication

1. **Register a patient:**
   - Go to `/auth/register`
   - Fill in the form
   - You'll be redirected to login

2. **Login:**
   - Go to `/auth/login`
   - Enter credentials
   - You'll be redirected to the appropriate dashboard

3. **Logout:**
   - Click logout in the sidebar (admin) or profile menu (patient)

## Database Models

### User Model
- `name`, `email`, `password`, `role`, `phone`
- Password is automatically hashed before saving

### Doctor Model
- `name`, `specialty`, `email`, `phone`, `image`, `rating`, `reviews`, etc.

### Appointment Model
- `patient` (ref: User), `doctor` (ref: Doctor), `date`, `time`, `type`, `status`, `price`

## Next Steps

1. Create API routes for doctors and appointments
2. Connect frontend pages to real data
3. Add appointment booking functionality
4. Implement AI chat integration
