import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '../../context/SidebarContext';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppShell() {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
