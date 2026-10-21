import { AdminDashboard } from "@/components/admin-dashboard";

export const metadata = { title: "관리자 · ListenUp" };

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-3xl font-black tracking-tight">관리자</h1>
      <div className="mt-6">
        <AdminDashboard />
      </div>
    </div>
  );
}
