import BottomNav from "@/components/BottomNav";

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      {children}
      <BottomNav />
    </div>
  );
}
