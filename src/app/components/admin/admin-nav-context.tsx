import { createContext, useContext } from "react";

type AdminNavContextType = {
  navigateTo: (page: string, id?: number) => void;
};

export const AdminNavContext = createContext<AdminNavContextType>({
  navigateTo: () => {},
});

export const useAdminNav = () => useContext(AdminNavContext);
