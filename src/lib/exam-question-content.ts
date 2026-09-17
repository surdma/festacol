export interface ExamQuestionMedia {
  src: string;
  alt: string;
}

export interface ExamQuestionContent {
  question: string;
  passage: string | null;
  media: ExamQuestionMedia | null;
}

const LOCAL_MEDIA = /^!\[([^\]]*)\]\((\/exam-assets\/[A-Za-z0-9._/-]+)\)\s*(?:\r?\n)+/u;
const PASSAGE = /^PASSAGE:\s*([\s\S]*?)\s*\n\s*QUESTION:\s*([\s\S]+)$/iu;

export function parseExamQuestionContent(prompt: string): ExamQuestionContent {
  let content = String(prompt ?? "").trim();
  let media: ExamQuestionMedia | null = null;

  const mediaMatch = content.match(LOCAL_MEDIA);
  if (mediaMatch) {
    media = {
      alt: mediaMatch[1].trim() || "Question illustration",
      src: mediaMatch[2],
    };
    content = content.slice(mediaMatch[0].length).trim();
  }

  const passageMatch = content.match(PASSAGE);
  if (passageMatch) {
    return {
      media,
      passage: passageMatch[1].trim(),
      question: passageMatch[2].trim(),
    };
  }

  return {
    media,
    passage: null,
    question: content,
  };
}
