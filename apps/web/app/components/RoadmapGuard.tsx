"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudentAuthStore } from "@/src/store/student-auth";

export function RoadmapGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = useStudentAuthStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setChecked(true);
      return;
    }
    // Career selection is stored in localStorage by the /student/careers page
    const selectedCareerId = localStorage.getItem("student_career_id");
    const selectedRoleId = localStorage.getItem("student_role_id");

    if (!selectedCareerId || !selectedRoleId) {
      router.push("/student/careers");
    } else {
      setChecked(true);
    }
  }, [isAuthenticated, router]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
