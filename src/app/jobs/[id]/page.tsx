import { Suspense } from "react";
import { JobView } from "@/components/job-view";

export default function JobPage({ params }: PageProps<"/jobs/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
      <Job params={params} />
    </Suspense>
  );
}

async function Job({ params }: { params: PageProps<"/jobs/[id]">["params"] }) {
  const { id } = await params;
  return <JobView id={id} />;
}
