import { RequireAuth } from "@/components/layout/require-auth";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <RequireAuth roles={["ADMIN"]}>{children}</RequireAuth>;
}
