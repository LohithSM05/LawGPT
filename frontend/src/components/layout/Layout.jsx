import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border py-6">
        <div className="container flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
          <span>LawGPT — AI-Driven Legal Evidence Analyzer</span>
          <span className="font-mono">Final Year Project · BE ISE</span>
        </div>
      </footer>
    </div>
  );
}
