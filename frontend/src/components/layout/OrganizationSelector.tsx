import React, { useState, useEffect } from 'react';
import { Building2, ChevronDown, LogIn, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiBase, getAuthHeadersWithUser } from '@/utils/apiBase';

interface Organization {
  id: string;
  name: string;
  domain?: string;
  logo_url?: string;
  deleted_at?: string;
}

interface OrganizationSelectorProps {
  isCollapsed?: boolean;
  organization: any;
  variant?: 'sidebar' | 'header';
  className?: string;
}

const OrganizationSelector: React.FC<OrganizationSelectorProps> = ({ 
  isCollapsed = false, 
  organization,
  variant = 'sidebar',
  className
}) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAll, setShowAll] = useState(false);

  const isHeaderVariant = variant === 'header';

  // Verificar se é Super Admin
  const roleName = profile?.role_name || profile?.roles?.name;
  const isSuperAdmin = roleName === 'Super Admin' || 
                      roleName === 'super_admin' || 
                      roleName === 'SuperAdmin';

  // Buscar organizações apenas se for Super Admin
  useEffect(() => {
    if (isSuperAdmin && user && profile) {
      fetchOrganizations();
    }
  }, [isSuperAdmin, user, profile]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeadersWithUser(user, profile);
      
      const response = await fetch(`${apiBase}/api/organizations`, {
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao carregar organizações');
      }

      const result = await response.json();
      setOrganizations(result.organizations || []);
    } catch (error) {
      console.error('Erro ao buscar organizações:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar organizações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchOrganization = async (orgId: string, orgName: string) => {
    try {
      setLoading(true);
      const headers = await getAuthHeadersWithUser(user, profile);
      
      const response = await fetch(`${apiBase}/api/organizations/${orgId}/switch`, {
        method: 'POST',
        headers
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: `Agora você está acessando como ${orgName}`,
        });
        
        // Recarregar a página para atualizar o contexto
        window.location.reload();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao trocar organização');
      }
    } catch (error) {
      console.error('Erro ao trocar organização:', error);
      toast({
        title: "Erro",
        description: "Falha ao trocar de organização",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  const handleCloseDropdown = () => {
    setIsOpen(false);
    setSearchTerm('');
    setShowAll(false);
  };

  // Se não for Super Admin, mostrar apenas o nome da organização
  if (!isSuperAdmin) {
    if (isHeaderVariant) {
      return (
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border border-gray-200/80 bg-transparent px-4 py-2 text-gray-900 min-h-[42px]',
            'min-w-[220px]',
            className
          )}
        >
          <span className="text-sm font-medium truncate">
            {organization?.name || 'Sem organização'}
          </span>
        </div>
      );
    }

    return (
      <div className={cn(
        'w-full transition-all duration-200 mb-4',
        isCollapsed ? 'px-2' : 'px-4',
        className
      )}>
        <div className={cn(
          'flex items-center gap-2 text-center justify-center',
          'bg-gradient-to-r from-blue-50 to-indigo-50',
          'border border-blue-200 rounded-lg py-2 px-3',
          'shadow-sm'
        )}>
          {!isCollapsed ? (
            <>
              <Building2 size={16} className="text-blue-600 flex-shrink-0" />
              <span className="text-sm text-blue-800 truncate">
                {organization?.name || 'Sem organização'}
              </span>
            </>
          ) : (
            <Building2 size={16} className="text-blue-600" />
          )}
        </div>
      </div>
    );
  }

  // Para Super Admins, mostrar dropdown
  const activeOrganizations = organizations.filter(org => !org.deleted_at);
  const currentOrg = activeOrganizations.find(org => org.id === organization?.id);
  
  // Filtrar organizações por termo de pesquisa
  const filteredOrganizations = activeOrganizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (org.domain && org.domain.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Limitar número de organizações mostradas (máximo 10 inicialmente)
  const MAX_INITIAL_ORGS = 10;
  const displayedOrganizations = showAll 
    ? filteredOrganizations 
    : filteredOrganizations.slice(0, MAX_INITIAL_ORGS);
  
  const hasMoreOrganizations = filteredOrganizations.length > MAX_INITIAL_ORGS;

  const shouldRenderDropdown = isOpen && (!isCollapsed || isHeaderVariant);
  const wrapperClasses = cn(
    isHeaderVariant
      ? 'relative w-fit'
      : 'w-full transition-all duration-200 mb-4',
    !isHeaderVariant && (isCollapsed ? 'px-2' : 'px-4'),
    className
  );
  const buttonClasses = cn(
    'flex items-center gap-2',
    isHeaderVariant
      ? 'w-full justify-between rounded-xl border border-gray-200/80 bg-transparent px-4 py-2 text-gray-900 min-h-[42px] min-w-[220px]'
      : 'w-full text-center justify-center bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg py-2 px-3 shadow-sm hover:shadow-md transition-all duration-200 hover:from-blue-100 hover:to-indigo-100',
    loading && 'opacity-50 cursor-not-allowed'
  );
  const collapsedOnlyView = isCollapsed && !isHeaderVariant;

  return (
    <div className={wrapperClasses}>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={loading}
          className={buttonClasses}
        >
          {collapsedOnlyView ? (
            <Building2 size={16} className="text-blue-600" />
          ) : (
            <>
              {!isHeaderVariant && (
                <Building2 size={16} className="text-blue-600 flex-shrink-0" />
              )}
              {isHeaderVariant ? (
                <span className="text-sm font-medium truncate flex-1 text-left">
                  {currentOrg?.name || organization?.name || 'Selecionar Organização'}
                </span>
              ) : (
                <span className="text-sm text-blue-800 truncate flex-1">
                  {currentOrg?.name || organization?.name || 'Selecionar Organização'}
                </span>
              )}
              <ChevronDown 
                size={14} 
                className={cn(
                  'text-blue-600 transition-transform duration-200',
                  isOpen && 'rotate-180'
                )} 
              />
            </>
          )}
        </button>

        {shouldRenderDropdown && (
          <div className={cn(
            'absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-hidden flex flex-col',
            isHeaderVariant ? 'mt-2 min-w-[280px]' : 'mt-1'
          )}>
            {/* Campo de pesquisa */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar organizações..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-8 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Lista de organizações */}
            <div className="flex-1 overflow-y-auto max-h-60">
              {loading ? (
                <div className="p-3 text-center text-sm text-gray-500">
                  Carregando organizações...
                </div>
              ) : displayedOrganizations.length === 0 ? (
                <div className="p-3 text-center text-sm text-gray-500">
                  {searchTerm ? 'Nenhuma organização encontrada' : 'Nenhuma organização disponível'}
                </div>
              ) : (
                <>
                  {displayedOrganizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => handleSwitchOrganization(org.id, org.name)}
                      disabled={loading || org.id === organization?.id}
                      className={cn(
                        'w-full flex items-center gap-2 p-3 text-left hover:bg-gray-50 transition-colors',
                        org.id === organization?.id && 'bg-blue-50 text-blue-700',
                        loading && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <Building2 size={14} className="text-gray-600 flex-shrink-0" />
                      <span className="text-sm truncate flex-1">
                        {org.name}
                      </span>
                      {org.id === organization?.id ? (
                        <span className="text-xs text-blue-600">Atual</span>
                      ) : (
                        <LogIn size={12} className="text-gray-400" />
                      )}
                    </button>
                  ))}
                  
                  {/* Botão para mostrar mais organizações */}
                  {hasMoreOrganizations && !showAll && (
                    <button
                      onClick={() => setShowAll(true)}
                      className="w-full p-3 text-center text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100"
                    >
                      Mostrar mais ({filteredOrganizations.length - MAX_INITIAL_ORGS} restantes)
                    </button>
                  )}
                  
                  {/* Botão para mostrar menos organizações */}
                  {showAll && hasMoreOrganizations && (
                    <button
                      onClick={() => setShowAll(false)}
                      className="w-full p-3 text-center text-sm text-gray-600 hover:bg-gray-50 border-t border-gray-100"
                    >
                      Mostrar menos
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Footer com contador */}
            {!loading && filteredOrganizations.length > 0 && (
              <div className="p-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 text-center">
                {searchTerm ? (
                  `${filteredOrganizations.length} de ${activeOrganizations.length} organizações`
                ) : (
                  `${activeOrganizations.length} organizações`
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overlay para fechar dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={handleCloseDropdown}
        />
      )}
    </div>
  );
};

export default OrganizationSelector;
