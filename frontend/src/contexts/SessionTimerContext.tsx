import React, { createContext, useContext, useState, useEffect } from 'react';

interface SessionTimerContextProps {
  maxSessionDuration: number;
  setMaxSessionDuration: (duration: number) => void;
}

const SessionTimerContext = createContext<SessionTimerContextProps | undefined>(undefined);

export const SessionTimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [maxSessionDuration, setMaxSessionDuration] = useState<number>(() => {
    const savedDuration = localStorage.getItem('maxSessionDuration');
    return savedDuration ? parseInt(savedDuration, 10) : Date.now() + 30 * 60000;
  });

  useEffect(() => {
    localStorage.setItem('maxSessionDuration', maxSessionDuration.toString());
  }, [maxSessionDuration]);

  return (
    <SessionTimerContext.Provider value={{ maxSessionDuration, setMaxSessionDuration }}>
      {children}
    </SessionTimerContext.Provider>
  );
};

export const useSessionTimer = (): SessionTimerContextProps => {
  const context = useContext(SessionTimerContext);
  if (!context) {
    throw new Error('useSessionTimer must be used within a SessionTimerProvider');
  }
  return context;
};
