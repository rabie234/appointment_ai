import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: 'patient' | 'admin';
    };
  }

  interface User {
    id: string;
    role: 'patient' | 'admin';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'patient' | 'admin';
  }
}
