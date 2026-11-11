import { MainWrap } from "@/components/MainWrap";
import { TabBar } from "@/components/TabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MainWrap>{children}</MainWrap>
      <TabBar />
    </>
  );
}
