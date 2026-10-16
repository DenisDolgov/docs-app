import Image from 'next/image';
import Link from 'next/link';

import { OrganizationSwitcher } from '@/app/(home)/organization-switcher';
import { UserMenu } from '@/components/user-menu';

export const HomeNavbar = () => {
  return (
    <nav className="flex items-center justify-between h-full w-full">
      <div className="flex gap-3 items-center shrink-0 pr-6">
        <Link href="/">
          <Image src="/logo.svg" alt="logo" width={36} height={36} />
        </Link>
        <h3 className="text-xl">Документы</h3>
      </div>
      <div className="flex gap-3 pl-6">
        <OrganizationSwitcher />
        <UserMenu />
      </div>
    </nav>
  );
};
