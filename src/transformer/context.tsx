import { type ReactNode, createContext, useContext, useState } from 'react';

type TransformerContextValue = {
  inputTypes: string[];
  setInputTypes: (types: string[]) => void;
};

export const TransformerContext = createContext<TransformerContextValue | null>(
  null,
);

export const TransformerProvider = ({ children }: { children: ReactNode }) => {
  const [inputTypes, setInputTypes] = useState<string[]>([]);

  return (
    <TransformerContext.Provider
      value={{
        inputTypes: inputTypes,
        setInputTypes: setInputTypes,
      }}
    >
      {children}
    </TransformerContext.Provider>
  );
};

export const useTransformerContext = () => {
  return useContext(TransformerContext)!;
};
