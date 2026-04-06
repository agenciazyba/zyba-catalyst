import BottomNav from "@/components/BottomNav";

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <div className="trip-route-body">{children}</div>
      <BottomNav />
    </div>
  );
}
