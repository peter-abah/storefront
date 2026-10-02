export const dynamic = "force-dynamic";

// Public pass-through — /admin/login/* must render without an admin
// session. The protected shell (gate + AdminNav) lives in
// app/admin/(protected)/layout.tsx so login never redirect-loops.
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
