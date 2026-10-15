# Festacol

### Better school examinations, from the first question to the final decision.

**Festacol is an examination and academic operations platform for secondary schools.** It connects the work of preparing assessments, giving students a clear place to take them, and helping educators understand what happened afterward.

I am building Festacol around a simple belief: an examination system should do more than display questions and calculate a score. It should make the process easier to manage, easier for students to navigate, and more dependable for the people making decisions from the results.

**Created by [@surdma](https://github.com/surdma)** · [Explore the product](#what-festacol-does) · [See the engineering work](#inside-the-repository) · [Get in touch](#lets-connect)

---

## The problem I set out to solve

A school examination is not a single event. Before a student answers the first question, someone has to organize subjects, classes, candidates, questions, schedules, and access. During the examination, students need a focused experience and confidence that their work will not be lost. Afterward, teachers and school leaders need records they can actually use.

When those steps are handled by disconnected tools and manual processes, mistakes become easier to make and harder to trace.

**Festacol brings those responsibilities into one connected workflow.** It is designed around the needs of students, teachers, and administrators, with different experiences and permissions for each.

## What Festacol does

| For students | For teachers and school administrators |
| --- | --- |
| Enter an assigned examination through an access link or QR code. | Create and manage examinations, including subject, class, candidate, and timing rules. |
| Take timed exams in a dedicated, responsive examination workspace. | Build and maintain a subject-based question bank. |
| Answer single-choice, multiple-answer, true/false, and fill-in questions, including questions with illustrations. | Organize students, staff, classes, subjects, and teaching assignments. |
| Move between questions, flag items, and see which responses are complete. | Review submissions, performance, examination history, and integrity records. |
| Keep progress saved and resume an eligible attempt when interrupted. | Manage controlled access, retakes, and academic placement decisions. |
| Review their examination history and learning analytics. | Use role-specific settings and a managed library of curriculum and question data. |

These are connected parts of the application, not separate demonstration screens. The repository includes the examination flows, staff tools, data relationships, and the rules behind them. It is still an actively developed product, and the existence of a feature in code should not be mistaken for a claim of school-wide deployment.

## The work behind the experience

The most important work in Festacol is not visible in a screenshot. It is in the decisions that make an examination system trustworthy and useful.

**A student's work must survive interruption.** The exam experience includes saved responses, attempt recovery, connection-state feedback, and server-backed timekeeping. A student should not have to start over simply because a page was refreshed or a connection became unreliable.

**Each examination must be delivered deliberately.** Festacol supports candidate-specific question and option ordering while preserving the allocated paper for an in-progress attempt. Exams can be targeted to the relevant students, classes, and subject offerings instead of being exposed indiscriminately.

**Access and accountability are part of the product.** Students, teachers, and administrators have distinct permissions. Examination access, retake decisions, and relevant integrity events are tied to persistent records. Optional camera requirements and browser activity signals support review; they are not presented as infallible proof of misconduct.

**A result needs context.** An exam score is more useful when connected to the subject, session, student, attempt history, and school structure behind it. Festacol models those relationships and provides views for student progress, reporting, and placement-related decisions.

**School operations deserve the same attention as the exam screen.** The staff workspace includes question management, academic structures, teaching scopes, staff and student records, and controlled publishing of prepared school content. That means the examination experience is supported by the real work required to run it.

## What building Festacol demonstrates

This project reflects how I approach software development: I start with a real problem, follow the people affected by it, and build the full workflow rather than stopping at an attractive interface.

- **Product judgment:** translating the different needs of students, educators, and school leaders into coherent experiences.
- **End-to-end ownership:** connecting interface design, application behavior, permissions, data, and reporting so they serve the same purpose.
- **Care with consequential data:** treating scores, student records, access decisions, and examination history as information that deserves clear rules and accountability.
- **Attention to everyday usability:** designing for timed tasks, interrupted sessions, complex question formats, and staff workflows that must remain understandable.
- **Long-term thinking:** organizing subjects, classes, teaching responsibilities, and assessment records as relationships that can support future work without losing their meaning.

I want the code to demonstrate more than familiarity with a technology stack. I want it to show the ability to recognize an operational problem, make sensible product decisions, and carry those decisions through to an implementable system.

## Inside the repository

If you would like to look beyond this overview, these are useful starting points:

| Explore | What it shows |
| --- | --- |
| [Student examination experience](src/components/exam/) | Exam entry, question presentation, timing, progress, and results. |
| [Exam lifecycle and answer handling](src/app/actions/exam-state.ts) | How papers, saved responses, and submissions are handled. |
| [Staff and school operations](src/components/admin/) | Exam creation, question management, student records, and administrative tools. |
| [Academic and examination data model](prisma/schema.prisma) | The relationships that connect schools, people, subjects, exams, and attempts. |
| [Quality and integration checks](.github/workflows/nextjs-quality.yml) | Automated checks for data consistency, application builds, and key access contracts. |
| [Development and setup guide](docs/DEVELOPMENT.md) | The technical instructions for engineers who want to run or contribute to the project. |

The application uses **Next.js, React, TypeScript, Supabase, PostgreSQL, and Prisma**. Those technologies are implementation choices; the larger goal is a school assessment experience that people can understand and depend on.

## Project status

**Festacol is under active development.** The repository documents the implemented application and the work involved in building it. It is not a claim of verified production adoption, measured learning outcomes, or an independently certified examination service. Those require evidence beyond source code.

The ambition is clear: make examinations less fragmented for schools and more thoughtful for students, while giving educators records they can use with confidence.

## Let's connect

I am interested in conversations with teams building educational products, assessment systems, and practical software for complex real-world workflows. If you are evaluating how I think, design, and build, Festacol is a place to start.

**[Connect with me on GitHub](https://github.com/surdma)** or [raise a question in the repository](https://github.com/surdma/festacol/issues).
