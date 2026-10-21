import { AdminDashboard } from "@/components/admin-dashboard";

export const metadata = { title: "관리자 · ListenUp" };

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-3xl font-black tracking-tight">관리자</h1>
      <p className="mt-2 text-sm text-muted">사용량, 저장 공간, 사용자를 한눈에 봐요. 관리자로 지정한 계정만 볼 수 있어요.</p>
      <div className="mt-6">
        <AdminDashboard />
      </div>
    </div>
  );
}
