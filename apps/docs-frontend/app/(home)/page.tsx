'use client';

import { useCallback, useEffect, useState } from 'react';

import { DocumentsTable } from '@/app/(home)/documents-table';
import { HomeNavbar } from '@/app/(home)/home-navbar';
import { TemplatesGallery } from '@/app/(home)/templates-gallery';
import { useAuth } from '@/components/auth-provider';
import { EmailVerificationBanner } from '@/components/email-verification-banner';
import type { DocumentDto } from '@/lib/api';
import { listDocuments } from '@/lib/documents';

const Home = () => {
  const { status } = useAuth();
  const [documents, setDocuments] = useState<DocumentDto[] | null>(null);
  const [hasError, setHasError] = useState(false);

  const reload = useCallback(async () => {
    try {
      setDocuments(await listDocuments());
      setHasError(false);
    } catch {
      setHasError(true);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;

    reload();
  }, [status, reload]);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="fixed top-0 left-0 right-0 z-10 h-16 bg-white p-4">
        <HomeNavbar />
      </div>
      <div className="mt-16">
        <EmailVerificationBanner />
        <TemplatesGallery onCreated={reload} />
        <DocumentsTable
          documents={documents}
          hasError={hasError}
          onChanged={reload}
        />
      </div>
    </div>
  );
};

export default Home;
