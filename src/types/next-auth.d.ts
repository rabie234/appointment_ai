import type { DefaultSession } from 'next-auth';
// Importing the JWT type is what makes the `next-auth/jwt` module
// augmentation below resolve — without it TS never loads that module.
import type { JWT } from 'next-auth/jwt';
import type { Role } from '@/lib/roles';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession['user'];
  }

  interface User {
    role: Role;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
  }
}
