"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOutStudentAction } from "@/app/actions/student";

interface Student {
  firstName: string;
  lastName: string;
  fullName: string;
  studentHash: string;
}

const StudentContext = createContext<{
  student: Student | null;
  setStudent: (s: Student | null) => void;
  signOut: () => void;
} | null>(null);

export function StudentProvider({ children, initial }: { children: React.ReactNode; initial: Student | null }) {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(initial);
  const [, startTransition] = useTransition();
  const signOut = useCallback(() => {
    startTransition(async () => {
      await signOutStudentAction();
      setStudent(null);
      router.push("/");
      router.refresh();
    });
  }, [router]);
  const value = useMemo(() => ({ student, setStudent, signOut }), [student, signOut]);
  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent() {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error("useStudent must be used inside StudentProvider");
  return ctx;
}
