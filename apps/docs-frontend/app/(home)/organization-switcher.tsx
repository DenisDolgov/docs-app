'use client';

import {
  Building2Icon,
  CheckIcon,
  ChevronsUpDownIcon,
  CircleUserIcon,
  MailPlusIcon,
  PlusIcon,
  UsersIcon,
} from 'lucide-react';
import { useState } from 'react';

import { CreateOrganizationDialog } from '@/components/create-organization-dialog';
import { OrganizationInvitesDialog } from '@/components/organization-invites-dialog';
import { OrganizationMembersDialog } from '@/components/organization-members-dialog';
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
import { canManageMembers } from '@/lib/organizations';

export const OrganizationSwitcher = () => {
  const {
    organizations,
    currentOrganizationId,
    currentOrganization,
    setCurrentOrganizationId,
  } = useOrganization();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isInvitesOpen, setIsInvitesOpen] = useState(false);

  // Приглашения видит только тот, кому бэкенд разрешит их список: у `member`
  // диалог упал бы в 403 сразу после открытия.
  const canManage = currentOrganization
    ? canManageMembers(currentOrganization.role)
    : false;

  return (
    <>
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
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsCreateOpen(true)}>
            <PlusIcon className="size-4" />
            Создать организацию
          </DropdownMenuItem>
          {currentOrganization && (
            <DropdownMenuItem onClick={() => setIsMembersOpen(true)}>
              <UsersIcon className="size-4" />
              Участники
            </DropdownMenuItem>
          )}
          {currentOrganization && canManage && (
            <DropdownMenuItem onClick={() => setIsInvitesOpen(true)}>
              <MailPlusIcon className="size-4" />
              Приглашения
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
      {currentOrganization && (
        <OrganizationMembersDialog
          organization={currentOrganization}
          open={isMembersOpen}
          onOpenChange={setIsMembersOpen}
        />
      )}
      {currentOrganization && (
        <OrganizationInvitesDialog
          organization={currentOrganization}
          open={isInvitesOpen}
          onOpenChange={setIsInvitesOpen}
        />
      )}
    </>
  );
};
