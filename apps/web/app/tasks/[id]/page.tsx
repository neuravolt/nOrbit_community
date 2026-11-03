"use client";

import { use } from "react";
import { PageShell } from "../../../src/components/ui/page";
import { TaskDetailView } from "../../../src/components/tasks/TaskDetailView";

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  return (
    <PageShell>
      <div className="bg-[#f8fafc] min-h-screen">
        <TaskDetailView taskId={id} isModal={false} />
      </div>
    </PageShell>
  );
}
