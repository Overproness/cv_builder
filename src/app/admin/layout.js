import { auth } from "@/auth";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { redirect } from "next/navigation";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/usage", label: "Usage" },
  { href: "/admin/funnels", label: "Funnels" },
  { href: "/admin/health", label: "Health" },
];

export default async function AdminLayout({ children }) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-6 border-b border-border mb-8 overflow-x-auto">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground hover:text-primary pb-3 whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </div>
        {children}
      </main>
      <Footer />
    </div>
  );
}
