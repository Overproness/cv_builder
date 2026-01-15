import bcrypt from 'bcryptjs';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { authConfig } from './auth.config';
import dbConnect from './lib/dbConnect';
import User from './models/User';

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          
          await dbConnect();
          const user = await User.findOne({ email });
          
          if (!user) return null;
          
          const passwordsMatch = await bcrypt.compare(password, user.password);
          if (passwordsMatch) {
            // Return a plain object with string id to avoid BSON serialization issues
            const idStr = user._id.toString();
            console.log('Authorize returning user with id:', idStr, 'Type:', typeof idStr);
            return {
              id: idStr,
              email: user.email,
              name: user.name,
            };
          }
        }

        console.log('Invalid credentials');
        return null;
      },
    }),
  ],
});
