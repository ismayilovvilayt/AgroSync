import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Şifrə', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email və şifrə daxil edin');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { company: true, farm: true },
        });

        if (!user || !user.isActive) {
          throw new Error('İstifadəçi tapılmadı və ya deaktivdir');
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error('Yanlış şifrə');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          companyId: user.companyId,
          companyName: user.company.name,
          farmId: user.farmId,
          farmName: user.farm?.name || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        // İlk login — bütün sahələri yaz
        token.id = user.id;
        token.role = (user as any).role;
        token.companyId = (user as any).companyId;
        token.companyName = (user as any).companyName;
        token.farmId = (user as any).farmId;
        token.farmName = (user as any).farmName;
      }

      // BUG FIX: Admin adı yenilənmə problemi
      // Session update trigger ediləndə və ya token refresh zamanı DB-dən aktual data gətir
      if (trigger === 'update' && token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            include: { company: true, farm: true },
          });
          if (dbUser) {
            token.name = dbUser.fullName;
            token.role = dbUser.role;
            token.farmId = dbUser.farmId;
            token.farmName = dbUser.farm?.name || null;
            token.companyName = dbUser.company.name;
          }
        } catch {
          // DB xətası olsa belə token-i saxla
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).companyId = token.companyId;
        (session.user as any).companyName = token.companyName;
        (session.user as any).farmId = token.farmId;
        (session.user as any).farmName = token.farmName;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
