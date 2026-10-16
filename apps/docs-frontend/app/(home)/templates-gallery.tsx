'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useOrganization } from '@/components/organization-provider';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { toast } from '@/components/ui/toast';
import { templates } from '@/consts/templates';
import { createDocument } from '@/lib/documents';
import { cn } from '@/lib/utils';

export const TemplatesGallery = ({ onCreated }: { onCreated: () => void }) => {
  const router = useRouter();
  const { currentOrganizationId } = useOrganization();
  const [isCreating, setIsCreating] = useState(false);

  const onTemplateClick = (title: string) => {
    setIsCreating(true);
    createDocument({ title, organizationId: currentOrganizationId })
      .then((document) => {
        onCreated();
        router.push(`/documents/${document.id}`);
      })
      .catch(() =>
        toast.add({
          type: 'error',
          title: 'Не удалось создать документ',
        }),
      )
      .finally(() => setIsCreating(false));
  };

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-16 py-6 flex flex-col gap-y-4">
        <h3 className="text-base font-medium">Создать документ</h3>
        <Carousel>
          <CarouselContent className="-ml-4">
            {templates.map((template) => (
              <CarouselItem
                key={template.id}
                className="basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6 2xl:basis-[14.285714%] pl-4"
              >
                <div
                  className={cn(
                    'aspect-[3/4] flex flex-col gap-y-2.5',
                    isCreating && 'pointer-events-none opacity-50',
                  )}
                >
                  <button
                    type="button"
                    disabled={isCreating}
                    onClick={() => onTemplateClick(template.label)}
                    style={{
                      backgroundImage: `url(${template.imageUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                    }}
                    className="size-full hover:border-blue-500 rounded-sm border hover:bg-blue-50 transition flex flex-col items-center justify-center gap-y-4 bg-white"
                  />
                  <p className="text-sm font-medium truncate">
                    {template.label}
                  </p>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
    </div>
  );
};
