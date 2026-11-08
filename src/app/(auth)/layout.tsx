export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="safe-top mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-6 pb-10">
      <div className="mt-10 mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-accent text-on-accent">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />
          </svg>
        </div>
        <span className="text-[22px] font-bold tracking-tight">Carga</span>
      </div>
      {children}
    </main>
  );
}
