import React, { ReactNode } from 'react';

// ✅ OBSOLETO: Este AuthProvider foi substituído pelo hook useAuth em src/hooks/useAuth.ts
// Mantido apenas para compatibilidade com componentes que ainda importam AuthProvider

interface AuthProviderProps {
    children: ReactNode;
}

// ✅ Wrapper simples - a autenticação é gerenciada pelo hook useAuth em src/hooks/useAuth.ts
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    return <>{children}</>;
};
