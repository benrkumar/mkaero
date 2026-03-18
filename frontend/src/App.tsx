import { BrowserRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useState } from "react";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import Dashboard from "./pages/Dashboard";
import LeadFinder from "./pages/LeadFinder";
import Contacts from "./pages/Contacts";
import EmailCampaigns from "./pages/EmailCampaigns";
import CampaignDetail from "./pages/CampaignDetail";
import CampaignBuilder from "./pages/CampaignBuilder";
import LinkedInOutreach from "./pages/LinkedInOutreach";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import CampaignWizard from "./pages/CampaignWizard";

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICONS: Record<string, string> = {
  dashboard: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  radar:     "M1 6l11 6 11-6M1 12l11 6 11-6M12 2v20",
  contacts:  "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
  email:     "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
  linkedin:  "M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z M2 9h4v12H2z M4 6a2 2 0 100-4 2 2 0 000 4z",
  analytics: "M18 20V10 M12 20V4 M6 20v-6",
  settings:  "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  ai:        "M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5",
  sun:       "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42 M12 17a5 5 0 100-10 5 5 0 000 10z",
  moon:      "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
  drone:     "M12 5l-3 3H5l3 3v3l4-3 4 3v-3l3-3h-4L12 5z M7 11l-4 4 M17 11l4 4 M10 17l2 3 2-3",
};
const PAGE_NAMES: Record<string, string> = {
  "/":          "Dashboard",
  "/leads":     "Lead Finder",
  "/contacts":  "Contacts",
  "/email":     "Email Campaigns",
  "/linkedin":  "LinkedIn Outreach",
  "/wizard":    "AI Campaign Wizard",
  "/analytics": "Analytics",
  "/settings":  "Settings",
};

function NavItem({ to, icon, label, highlight, end }: { to: string; icon: string; label: string; highlight?: boolean; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg text-sm transition-all
        ${isActive
          ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
          : highlight
          ? "text-violet-400 hover:bg-violet-500/10"
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-600 hover:text-slate-900 dark:hover:text-white"
        }`
      }
    >
      <span className="shrink-0 opacity-80"><Icon d={ICONS[icon] ?? ICONS.dashboard} size={15} /></span>
      <span className="flex-1 font-medium">{label}</span>
      {highlight && <span className="text-xs bg-violet-500/30 text-violet-300 rounded px-1.5">AI</span>}
    </NavLink>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <p className="px-5 pt-5 pb-1 text-xs uppercase tracking-widest text-slate-400 dark:text-surface-200 font-semibold">{children}</p>;
}
function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme, toggle } = useTheme();
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={onClose}
          onTouchEnd={(e) => { e.preventDefault(); onClose(); }}
        />
      )}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-56 flex flex-col bg-white dark:bg-surface-950
          border-r border-slate-200 dark:border-surface-400/20 overflow-y-auto
          transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:static md:translate-x-0 md:shrink-0 md:h-[100dvh]
        `}
        style={{ willChange: "transform" }}
      >
        <div className="p-4 border-b border-slate-200 dark:border-surface-400/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-drone flex items-center justify-center shrink-0 text-white text-xs font-bold">
              IAS
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-surface-100 truncate">Indo Aerial Systems</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Marketing Control Center</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-2" onClick={onClose}>
          <SectionLabel>Overview</SectionLabel>
          <NavItem to="/" end icon="dashboard" label="Dashboard" />

          <SectionLabel>Intelligence</SectionLabel>
          <NavItem to="/leads"    icon="radar"    label="Lead Finder" />
          <NavItem to="/contacts" icon="contacts" label="Contacts" />

          <SectionLabel>Campaigns</SectionLabel>
          <NavItem to="/email"    icon="email"    label="Email Campaigns" />
          <NavItem to="/linkedin" icon="linkedin" label="LinkedIn Outreach" />
          <NavItem to="/wizard"   icon="ai"       label="AI Wizard" highlight />

          <SectionLabel>Insights</SectionLabel>
          <NavItem to="/analytics" icon="analytics" label="Analytics" />

          <SectionLabel>System</SectionLabel>
          <NavItem to="/settings" icon="settings" label="Settings" />
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-surface-400/20 space-y-2">
          <button
            onClick={toggle}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-surface-700 hover:bg-slate-200 dark:hover:bg-surface-600 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs transition"
          >
            <Icon d={theme === "dark" ? ICONS.sun : ICONS.moon} size={13} />
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          <p className="text-xs text-slate-400 dark:text-surface-200 text-center leading-relaxed">Tough Parts. Smart Prices. Made in India.</p>
        </div>
      </aside>
    </>
  );
}

function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const location = useLocation();
  const title = PAGE_NAMES[location.pathname] ?? "Campaign Builder";
  return (
    <header className="h-12 shrink-0 bg-white dark:bg-surface-900 border-b border-slate-200 dark:border-surface-400/20 flex items-center px-4 md:px-6 gap-3">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-700 transition"
        aria-label="Open menu"
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex-1 truncate">{title}</h2>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Online
        </div>
        <div className="w-7 h-7 rounded-full bg-gradient-drone flex items-center justify-center text-white text-xs font-bold shrink-0">IAS</div>
      </div>
    </header>
  );
}

function AppInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex flex-1 h-[100dvh] overflow-hidden bg-slate-50 dark:bg-surface-900">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-surface-900 overscroll-none" style={{ WebkitOverflowScrolling: "touch" }}>
          <Routes>
            <Route path="/"                  element={<Dashboard />} />
            <Route path="/leads"             element={<LeadFinder />} />
            <Route path="/contacts"          element={<Contacts />} />
            <Route path="/email"             element={<EmailCampaigns />} />
            <Route path="/email/builder"     element={<CampaignBuilder />} />
            <Route path="/email/builder/:id" element={<CampaignBuilder />} />
            <Route path="/campaigns/:id"     element={<CampaignDetail />} />
            <Route path="/linkedin"          element={<LinkedInOutreach />} />
            <Route path="/wizard"            element={<CampaignWizard />} />
            <Route path="/analytics"         element={<Analytics />} />
            <Route path="/settings"          element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </ThemeProvider>
  );
}
