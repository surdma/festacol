"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
} from "react";
import { signOutStudentAction } from "@/app/actions/student";

interface Student {
  profileId: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

const StudentContext = createContext<{
  student: Student | null;
  setStudent: (student: Student | null) => void;
  signOut: (returnTo?: string) => void;
} | null>(null);

export function StudentProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: Student | null;
}) {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(initial);
  const [, startTransition] = useTransition();
  const signOut = useCallback(
    (returnTo?: string) => {
      startTransition(async () => {
        await signOutStudentAction();
        setStudent(null);
        const destination =
          returnTo && returnTo.startsWith("/dashboard") ? returnTo : "/";
        router.push(destination);
        router.refresh();
      });
    },
    [router],
  );
  const value = useMemo(
    () => ({ student, setStudent, signOut }),
    [student, signOut],
  );
  return (
    <StudentContext.Provider value={value}>{children}</StudentContext.Provider>
  );
}

export function useStudent() {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error("useStudent must be used inside StudentProvider");
  return ctx;
}
