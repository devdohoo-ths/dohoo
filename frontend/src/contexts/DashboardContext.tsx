import React, { createContext, useContext, useState, ReactNode } from 'react';

export type DashboardPeriod = '24h' | '7d' | '30d';

interface DashboardContextType {
  selectedPeriod: DashboardPeriod;
  setSelectedPeriod: (period: DashboardPeriod) => void;
  getDateRange: () => { start: Date; end: Date };
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboardContext = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  return context;
};

interface DashboardProviderProps {
  children: ReactNode;
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ children }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardPeriod>('7d');

  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    
    switch (selectedPeriod) {
      case '24h':
        start.setHours(end.getHours() - 24);
        break;
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      default:
        start.setDate(end.getDate() - 7);
    }
    
    return { start, end };
  };

  const value: DashboardContextType = {
    selectedPeriod,
    setSelectedPeriod,
    getDateRange
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};


