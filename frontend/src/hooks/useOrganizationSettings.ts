import { useState, useEffect } from 'react';
import { useOrganization } from './useOrganization';
import { apiBase, getAuthHeaders } from '@/utils/apiBase';

export interface OrganizationSettings {
  disabledModules?: string[];
  customPermissions?: Record<string, boolean>;
  features?: {
    automation?: boolean;
    advancedSettings?: boolean;
    marketplace?: boolean;
    aiPlayground?: boolean;
  };
  proxy?: string | null;
}

export const useOrganizationSettings = () => {
  const { organization } = useOrganization();
  const [settings, setSettings] = useState<OrganizationSettings>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!organization?.id) return;

    const fetchSettings = async () => {
      setLoading(true);
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${apiBase}/api/organizations/${organization.id}/settings`, {
          headers
        });

        if (response.ok) {
          const data = await response.json();
          setSettings(data.settings || {});
        }
      } catch (error) {
        console.error('Erro ao carregar configurações da organização:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [organization?.id]);

  const isModuleEnabled = (moduleId: string): boolean => {
    if (!settings.disabledModules) return true;
    return !settings.disabledModules.includes(moduleId);
  };

  const isFeatureEnabled = (feature: keyof OrganizationSettings['features']): boolean => {
    return settings.features?.[feature] ?? true;
  };

  return {
    settings,
    loading,
    isModuleEnabled,
    isFeatureEnabled
  };
}; 