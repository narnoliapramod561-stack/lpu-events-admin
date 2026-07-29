import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Instrument_Sans, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/auth/auth-provider';
import { AnalyticsProvider } from '@/components/observability/analytics-provider';
import { ErrorBoundary } from '@/components/observability/error-boundary';
import { getSession, getUserProfile } from '@/lib/auth';
import { buildAbsoluteUrl, getSiteUrl } from '@/lib/site';
import { getPublicEnv } from '@/lib/env';
import {
  DEFAULT_OG_IMAGE_PATH,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  serializeJsonLd,
} from '@/lib/seo/schema';
import { DEFAULT_DESCRIPTION, buildCanonicalUrl } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

const bodyFont = Instrument_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'optional',
});

const displayFont = Space_Grotesk({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'optional',
});

export const metadata: Metadata = {
  title: 'LPU Events Admin | Organizer and Super Admin Portal',
  description: 'Organizer and super admin workspace for managing LPU Events.',
  metadataBase: new URL(buildAbsoluteUrl('/')),
  alternates: {
    canonical: buildCanonicalUrl(getSiteUrl(), '/'),
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'LPU Events Admin | Organizer and Super Admin Portal',
    description: 'Organizer and super admin workspace for managing LPU Events.',
    url: buildCanonicalUrl(getSiteUrl(), '/'),
    siteName: 'LPU Events Admin',
    type: 'website',
    images: [
      {
        url: buildAbsoluteUrl(DEFAULT_OG_IMAGE_PATH),
        width: 1200,
        height: 630,
        alt: 'LPU Events Admin',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LPU Events Admin | Organizer and Super Admin Portal',
    description: 'Organizer and super admin workspace for managing LPU Events.',
    images: [buildAbsoluteUrl(DEFAULT_OG_IMAGE_PATH)],
  },
  other: {
    'theme-color': '#fa5e29',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, profile] = await Promise.all([getSession(), getUserProfile()]);
  const siteUrl = getSiteUrl();
  const publicEnv = getPublicEnv();

  const orgJsonLd = buildOrganizationJsonLd(siteUrl);
  const websiteJsonLd = buildWebSiteJsonLd(siteUrl);

  return (
    <html lang="en">
      <head>
        {/* Preconnect & DNS prefetch performance hints for Supabase DB domain */}
        <link rel="preconnect" href={publicEnv.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={publicEnv.NEXT_PUBLIC_SUPABASE_URL} />

        {/* Visible material symbol stylesheet */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=optional"
        />

        {/* Injected Organization JSON-LD Schema */}
        <script
          type="application/ld+json"
          id="organization-jsonld"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(orgJsonLd) }}
        />

        {/* Injected WebSite SearchAction JSON-LD Schema */}
        <script
          type="application/ld+json"
          id="website-jsonld"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteJsonLd) }}
        />
      </head>
      <body className={`${bodyFont.variable} ${displayFont.variable} antialiased`}>
        <ErrorBoundary fallback={<div className="flex min-h-screen items-center justify-center text-sm text-white/72">Something went wrong. Please refresh the page.</div>}>
          <AuthProvider initialSession={session} initialProfile={profile}>
            <Suspense fallback={null}>
              <AnalyticsProvider />
            </Suspense>
            {children}
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
