"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Attempt {
  attempt_hash: string;
  session_id: string | null;
  session_title: string;
  student_name: string;
  score: number | null;
  integrity_score: number | null;
  submitted_at: number | null;
}
interface FeedItem { student: string; type: string; hash: string; at?: number }

type ReportView = "exams" | "students" | "integrity";

export function ReportsTabs({ attempts, titles, feed, initialView }: { attempts: Attempt[]; titles: Record<string, string>; feed: FeedItem[]; initialView: ReportView }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const byExam = new Map<string, { total: number; sum: number; submitted: number }>();
  for (const attempt of attempts) {
    const key = attempt.session_id ?? attempt.session_title;
    const value = byExam.get(key) ?? { total: 0, sum: 0, submitted: 0 };
    value.total += 1;
    if (attempt.submitted_at) { value.submitted += 1; value.sum += attempt.score ?? 0; }
    byExam.set(key, value);
  }
  const byStudent = new Map<string, { total: number; sum: number; integrity: number; latest: string }>();
  for (const attempt of attempts.filter((item) => item.submitted_at)) {
    const value = byStudent.get(attempt.student_name) ?? { total: 0, sum: 0, integrity: 0, latest: attempt.attempt_hash };
    value.total += 1; value.sum += attempt.score ?? 0; value.integrity += attempt.integrity_score ?? 100; value.latest = attempt.attempt_hash;
    byStudent.set(attempt.student_name, value);
  }

  function changeView(value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("view", value);
    next.delete("modal");
    next.delete("attempt");
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <Tabs value={initialView} onValueChange={changeView}>
      <TabsList variant="line" className="max-w-full overflow-x-auto">
        <TabsTrigger value="exams">Exams</TabsTrigger>
        <TabsTrigger value="students">Students</TabsTrigger>
        <TabsTrigger value="integrity">Integrity</TabsTrigger>
      </TabsList>
      <TabsContent value="exams">
        {byExam.size ? <Card className="overflow-hidden"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Exam</TableHead><TableHead>Attempts</TableHead><TableHead>Average</TableHead></TableRow></TableHeader><TableBody>{[...byExam.entries()].map(([key, value]) => <TableRow key={key}><TableCell><Link href={`/admin/exams?modal=exam&exam=${encodeURIComponent(key)}`} className="font-medium hover:underline">{titles[key] ?? key}</Link></TableCell><TableCell>{value.submitted}/{value.total} submitted</TableCell><TableCell>{value.submitted ? `${Math.round(value.sum / value.submitted)}%` : "—"}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card> : <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No exam attempt data yet.</CardContent></Card>}
      </TabsContent>
      <TabsContent value="students">
        {byStudent.size ? <Card className="overflow-hidden"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Submitted</TableHead><TableHead>Average</TableHead><TableHead>Integrity</TableHead><TableHead>Latest attempt</TableHead></TableRow></TableHeader><TableBody>{[...byStudent.entries()].map(([name, value]) => <TableRow key={name}><TableCell className="font-medium">{name}</TableCell><TableCell>{value.total}</TableCell><TableCell>{Math.round(value.sum / value.total)}%</TableCell><TableCell>{Math.round(value.integrity / value.total)}%</TableCell><TableCell><Link href={`/admin/reports?view=students&modal=attempt&attempt=${encodeURIComponent(value.latest)}`} className="font-mono text-xs hover:underline">Open</Link></TableCell></TableRow>)}</TableBody></Table></CardContent></Card> : <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Submitted student attempts will appear here.</CardContent></Card>}
      </TabsContent>
      <TabsContent value="integrity">
        {feed.length ? <Card className="overflow-hidden"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Event</TableHead><TableHead>Time</TableHead><TableHead>Attempt</TableHead></TableRow></TableHeader><TableBody>{feed.map((item, index) => <TableRow key={`${item.hash}-${item.type}-${index}`}><TableCell>{item.student}</TableCell><TableCell><StatusBadge tone="amber">{item.type}</StatusBadge></TableCell><TableCell className="text-xs text-muted-foreground">{item.at ? new Date(item.at).toLocaleString() : "—"}</TableCell><TableCell><Link href={`/admin/reports?view=integrity&modal=attempt&attempt=${encodeURIComponent(item.hash)}`} className="font-mono text-xs hover:underline">{item.hash.slice(0, 12)}…</Link></TableCell></TableRow>)}</TableBody></Table></CardContent></Card> : <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No review-worthy integrity events are visible in your scope.</CardContent></Card>}
      </TabsContent>
    </Tabs>
  );
}
