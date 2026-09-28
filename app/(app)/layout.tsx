import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/side-layout/components/Sidebar";
import { UserButton } from "@clerk/nextjs";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="relative">
        <div className="absolute top-4 right-4 z-10">
          <UserButton />
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}