import { Sidebar } from "@/components/layout/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-text-primary">
      <Sidebar />
      <main className="flex-1 p-6 md:p-10 max-w-[1600px] mx-auto w-full min-w-0">{children}</main>
    </div>
  );
}

