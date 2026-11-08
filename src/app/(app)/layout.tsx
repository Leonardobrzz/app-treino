import { TabBar } from "@/components/TabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto w-full max-w-[520px] pb-32">{children}</main>
      <TabBar />
    </>
  );
}
