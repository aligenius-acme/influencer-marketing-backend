import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { config } from './index.js';
import { AuthService } from '../services/auth.service.js';

const authService = new AuthService();

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: config.google.clientId,
      clientSecret: config.google.clientSecret,
      callbackURL: config.google.callbackUrl,
      scope: ['email', 'profile'],
    },
    async (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: (error: Error | null, user?: any) => void
    ) => {
      try {
        // Extract email from profile
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email found in Google profile'));
        }

        // Find or create user
        const result = await authService.findOrCreateGoogleUser({
          googleId: profile.id,
          email,
          displayName: profile.displayName,
          avatarUrl: profile.photos?.[0]?.value,
        });

        return done(null, result);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

// Serialize user (not used with JWT, but required by Passport)
passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((user: any, done) => {
  done(null, user);
});

export default passport;
