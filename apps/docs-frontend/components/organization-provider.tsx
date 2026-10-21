'use client';

import { organizationRoute } from '@docs-app/contracts/organization/routes';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/components/auth-provider';
import { apiJson, type OrganizationDto } from '@/lib/api';
import { createOrganization as apiCreateOrganization } from '@/lib/organizations';

const STORAGE_KEY = 'docs.currentOrganizationId';

interface OrganizationContextValue {
  organizations: OrganizationDto[];
  currentOrganizationId: string | null;
  currentOrganization: OrganizationDto | null;
  setCurrentOrganizationId: (organizationId: string | null) => void;
  refreshOrganizations: () => Promise<void>;
  createOrganization: (name: string) => Promise<OrganizationDto>;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(
  null,
);

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const { status } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationDto[]>([]);
  const [currentOrganizationId, setCurrentOrganizationIdState] = useState<
    string | null
  >(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setCurrentOrganizationIdState(stored);
  }, []);

  const refreshOrganizations = useCallback(async () => {
    const list = await apiJson<OrganizationDto[]>(
      organizationRoute.paths.collection,
    );
    setOrganizations(list);
    return;
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;

    refreshOrganizations().catch(() => setOrganizations([]));
  }, [status, refreshOrganizations]);

  const setCurrentOrganizationId = useCallback(
    (organizationId: string | null) => {
      setCurrentOrganizationIdState(organizationId);

      if (organizationId) {
        window.localStorage.setItem(STORAGE_KEY, organizationId);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    },
    [],
  );

  const createOrganization = useCallback(
    async (name: string) => {
      const created = await apiCreateOrganization(name);
      const createdOrganization = { ...created, role: 'owner' } as const;

      // Создатель точно становится owner. Кладём организацию в список сразу,
      // чтобы выбрать её даже при сбое повторного GET; refresh потом сгладит
      // расхождения.
      setOrganizations((current) =>
        current.some((organization) => organization.id === created.id)
          ? current
          : [...current, createdOrganization],
      );
      setCurrentOrganizationId(created.id);
      await refreshOrganizations().catch(() => undefined);

      return createdOrganization;
    },
    [refreshOrganizations, setCurrentOrganizationId],
  );

  // Выбранная организация может исчезнуть (вышел из неё / удалена) —
  // возвращаемся к личному контексту.
  useEffect(() => {
    if (!currentOrganizationId) return;
    if (!organizations.length) return;

    const stillMember = organizations.some(
      (organization) => organization.id === currentOrganizationId,
    );
    if (!stillMember) setCurrentOrganizationId(null);
  }, [organizations, currentOrganizationId, setCurrentOrganizationId]);

  const currentOrganization = useMemo(
    () =>
      organizations.find(
        (organization) => organization.id === currentOrganizationId,
      ) ?? null,
    [organizations, currentOrganizationId],
  );

  const value = useMemo<OrganizationContextValue>(
    () => ({
      organizations,
      currentOrganizationId,
      currentOrganization,
      setCurrentOrganizationId,
      refreshOrganizations,
      createOrganization,
    }),
    [
      organizations,
      currentOrganizationId,
      currentOrganization,
      setCurrentOrganizationId,
      refreshOrganizations,
      createOrganization,
    ],
  );

  return <OrganizationContext value={value}>{children}</OrganizationContext>;
};

export const useOrganization = (): OrganizationContextValue => {
  const context = useContext(OrganizationContext);

  if (!context) {
    throw new Error(
      'useOrganization должен вызываться внутри OrganizationProvider',
    );
  }

  return context;
};
