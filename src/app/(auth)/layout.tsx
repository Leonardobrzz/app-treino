import { AuthTop } from "./AuthTop";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="safe-top mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-6 pb-10">
      <AuthTop />
      {children}
    </main>
  );
}
