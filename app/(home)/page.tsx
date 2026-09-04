'use client';

import { usePaginatedQuery } from 'convex/react';

import { DocumentsTable } from '@/app/(home)/documents-table';
import { api } from '@/convex/_generated/api';

import { HomeNavbar } from './home-navbar';
import { TemplatesGallery } from './templates-gallery';

const Home = () => {
  const {
    results: documents,
    status,
    loadMore,
  } = usePaginatedQuery(api.documents.get, {}, { initialNumItems: 5 });

  return (
    <div className="flex flex-col min-h-screen">
      <div className="fixed top-0 left-0 right-0 z-10 h-16 bg-white p-4">
        <HomeNavbar />
      </div>
      <div className="mt-16">
        <TemplatesGallery />
        <DocumentsTable
          documents={documents}
          status={status}
          loadMore={loadMore}
        />
      </div>
    </div>
  );
};

export default Home;
