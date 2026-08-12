import { createContext, useState, useCallback } from 'react';

export const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false); // desktop: full rail vs icon-only rail
  const [isMobileOpen, setIsMobileOpen] = useState(false); // mobile: drawer overlay

  const toggleCollapsed = useCallback(() => setIsCollapsed((v) => !v), []);
  const openMobile = useCallback(() => setIsMobileOpen(true), []);
  const closeMobile = useCallback(() => setIsMobileOpen(false), []);

  const value = { isCollapsed, toggleCollapsed, isMobileOpen, openMobile, closeMobile };

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
