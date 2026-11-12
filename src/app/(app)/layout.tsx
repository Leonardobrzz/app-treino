import { MainWrap } from "@/components/MainWrap";
import { TabBar } from "@/components/TabBar";
import { PersonalSidebar } from "@/components/personal/common";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MainWrap>{children}</MainWrap>
      <PersonalSidebar />
      <TabBar />
    </>
  );
}
