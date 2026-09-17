import { z } from "zod";

export const studentLoginSchema = z.object({
  firstName: z.string().trim().min(2, "Enter the student first name.").max(40),
  lastName: z.string().trim().min(2, "Enter the student last name.").max(40),
});

export const examHelpRequestSchema = z.object({
  token: z.string().trim().min(32, "A valid examination link is required.").max(96),
  requesterName: z
    .string()
    .trim()
    .min(2, "Enter the candidate name.")
    .max(80, "Candidate name is too long."),
  category: z.enum([
    "examination_access",
    "candidate_identity",
    "device_browser",
    "other_examination_support",
  ]),
  message: z
    .string()
    .trim()
    .min(6, "Describe the examination support you need.")
    .max(500, "Keep the support message within 500 characters."),
});

export const examIdSchema = z.object({
  examId: z.string().trim().min(3, "Enter a valid Exam ID.").max(32),
});

export const examCreateSchema = z.object({
  title: z.string().trim().min(3).max(72),
  classLevel: z.enum(["SS1", "SS2", "SS3"]),
  classGroup: z.string().max(40).default("General"),
  mode: z.enum(["qualifier", "bece", "waec", "neco", "jamb", "mixed", "single"]),
  subjects: z.array(z.string()).default([]),
  durationSeconds: z.number().int().min(30).max(14400),
  questionCount: z.number().int().min(5).max(200),
  status: z.enum(["open", "draft", "closed"]).default("draft"),
  instructions: z.string().max(140).default(""),
});

export type StudentLoginInput = z.infer<typeof studentLoginSchema>;
export type ExamHelpRequestCategory = z.infer<typeof examHelpRequestSchema>["category"];
