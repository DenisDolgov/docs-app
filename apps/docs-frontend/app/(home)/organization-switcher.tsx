'use client';

import {
  Building2Icon,
  CheckIcon,
  ChevronsUpDownIcon,
  CircleUserIcon,
} from 'lucide-react';

import { useOrganization } from '@/components/organization-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const OrganizationSwitcher = () => {
  const {
    organizations,
    currentOrganizationId,
    currentOrganization,
    setCurrentOrganizationId,
  } = useOrganization();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="gap-2">
            {currentOrganization ? (
              <Building2Icon className="size-4" />
            ) : (
              <CircleUserIcon className="size-4" />
            )}
            <span className="max-w-[160px] truncate">
              {currentOrganization?.name ?? 'Персональный'}
            </span>
            <ChevronsUpDownIcon className="size-4 opacity-50" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Контекст создания</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setCurrentOrganizationId(null)}>
          <CircleUserIcon className="size-4" />
          <span className="truncate">Персональный</span>
          {!currentOrganizationId && <CheckIcon className="ml-auto size-4" />}
        </DropdownMenuItem>
        {organizations.map((organization) => (
          <DropdownMenuItem
            key={organization.id}
            onClick={() => setCurrentOrganizationId(organization.id)}
          >
            <Building2Icon className="size-4" />
            <span className="truncate">{organization.name}</span>
            {currentOrganizationId === organization.id && (
              <CheckIcon className="ml-auto size-4" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
