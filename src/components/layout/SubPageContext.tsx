import { createContext, useContext } from 'react';

export interface SubPageContextValue {
  requestClose: () => void;
  scrollToTop?: () => void;
}

export const SubPageContext = createContext<SubPageContextValue | null>(null);

export function useSubPage() {
  return useContext(SubPageContext);
}
