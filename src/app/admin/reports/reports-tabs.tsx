"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";

interface Attempt {
  attempt_hash: string; session_id: string | null; session_title: string; student_name: string;
  score: number | null; integrity_score: number | null; submitted_at: number | null;
}

interface FeedItem { student: string; type: string; hash: string }

export function ReportsTabs({ attempts, titles, feed }: { attempts: Attempt[]; titles: Record<string, string>; feed: FeedItem[] }) {
  const byExam = new Map<string, { total: number; sum: number; submitted: number }>();
  for (const a of attempts) {
    const key = a.session_id ?? a.session_title;
    const b = byExam.get(key) ?? { total: 0, sum: 0, submitted: 0 };
    b.total += 1;
    if (a.submitted_at) { b.submitted += 1; b.sum += a.score ?? 0; }
    byExam.set(key, b);
  }
  const byStudent = new Map<string, { total: number; sum: number; integrity: number }>();
  for (const a of attempts.filter((x) => x.submitted_at)) {
    const b = byStudent.get(a.student_name) ?? { total: 0, sum: 0, integrity: 0 };
    b.total += 1; b.sum += a.score ?? 0; b.integrity += a.integrity_score ?? 100;
    byStudent.set(a.student_name, b);
  }
  const integrityFeed = feed;

  return (
    <Tabs defaultValue="exams">
      <TabsList>
        <TabsTrigger value="exams">Exams</TabsTrigger>
        <TabsTrigger value="students">Students</TabsTrigger>
        <TabsTrigger value="integrity">Integrity</TabsTrigger>
      </TabsList>
      <TabsContent value="exams">
        <Card><CardContent className="p-0"><Table>
          <TableHeader><TableRow><TableHead>Exam</TableHead><TableHead>Attempts</TableHead><TableHead>Average</TableHead></TableRow></TableHeader>
          <TableBody>{[...byExam.entries()].map(([key, b]) => (
            <TableRow key={key}><TableCell>{titles[key] ?? key}</TableCell><TableCell>{b.submitted}/{b.total}</TableCell>
              <TableCell>{b.submitted ? `${Math.round(b.sum / b.submitted)}%` : "—"}</TableCell></TableRow>))}
          </TableBody>
        </Table></CardContent></Card>
      </TabsContent>
      <TabsContent value="students">
        <Card><CardContent className="p-0"><Table>
          <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Attempts</TableHead><TableHead>Average</TableHead><TableHead>Integrity</TableHead></TableRow></TableHeader>
          <TableBody>{[...byStudent.entries()].map(([name, b]) => (
            <TableRow key={name}><TableCell>{name}</TableCell><TableCell>{b.total}</TableCell>
              <TableCell>{Math.round(b.sum / b.total)}%</TableCell><TableCell>{Math.round(b.integrity / b.total)}%</TableCell></TableRow>))}
          </TableBody>
        </Table></CardContent></Card>
      </TabsContent>
      <TabsContent value="integrity">
        <Card><CardContent className="p-0"><Table>
          <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Event</TableHead><TableHead>Attempt</TableHead></TableRow></TableHeader>
          <TableBody>{integrityFeed.map((e, i) => (
            <TableRow key={`${e.hash}-${i}`}><TableCell>{e.student}</TableCell>
              <TableCell><StatusBadge tone="amber">{e.type}</StatusBadge></TableCell>
              <TableCell><Link href={`/admin/reports?modal=attempt&attempt=${e.hash}`} className="font-mono text-xs hover:underline">{e.hash.slice(0, 12)}…</Link></TableCell></TableRow>))}
          </TableBody>
        </Table></CardContent></Card>
      </TabsContent>
    </Tabs>
  );
}
