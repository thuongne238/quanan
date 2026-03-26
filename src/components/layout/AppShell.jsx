import BottomNav from './BottomNav';

const AppShell = ({ children }) => {
  return (
    <div className="min-h-screen bg-[var(--md-surface)] flex flex-col">
      {/* Main content area */}
      <main className="flex-1 pb-32 overflow-y-auto">
        {children}
      </main>
      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default AppShell;
