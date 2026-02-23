export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const protectedPaths = ['/cv', '/tailor', '/documents', '/settings'];
      const isProtected =
        protectedPaths.some((p) => nextUrl.pathname.startsWith(p)) ||
        nextUrl.pathname.startsWith('/api/cv') ||
        nextUrl.pathname.startsWith('/api/resume') ||
        nextUrl.pathname.startsWith('/api/cover-letter') ||
        nextUrl.pathname.startsWith('/api/settings');

      // Allow access to auth API routes and public pages
      if (nextUrl.pathname.startsWith('/api/auth')) return true;

      if (isProtected) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        // Redirect logged-in users away from login/signup pages to dashboard/home
        if (nextUrl.pathname === '/login' || nextUrl.pathname === '/signup') {
            return Response.redirect(new URL('/', nextUrl));
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (token?.sub) {
        // Ensure id is always a string, not a buffer or ObjectId
        session.user.id = String(token.sub);
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        // Handle various possible formats of user.id
        let userId;
        if (typeof user.id === 'string') {
          userId = user.id;
        } else if (user.id && typeof user.id === 'object' && user.id.toString) {
          userId = user.id.toString();
        } else if (user._id) {
          userId = typeof user._id === 'string' ? user._id : user._id.toString();
        } else {
          userId = String(user.id);
        }
        console.log('JWT callback - user.id:', user.id, 'resolved userId:', userId);
        token.sub = userId;
      }
      return token;
    },
  },
  providers: [], // Add providers with an empty array for now
};
