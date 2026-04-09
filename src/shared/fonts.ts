export type FontEntry = {
  readonly id: string;
  readonly name: string;
  readonly family: string;
};

export const bodyFonts: ReadonlyArray<FontEntry> = [
  { id: 'suit', name: 'SUIT', family: "'SUIT Variable', sans-serif" },
  { id: 'pretendard', name: 'Pretendard', family: "'Pretendard Variable', sans-serif" },
  { id: 'noto-serif-kr', name: 'Noto Serif KR', family: "'Noto Serif KR', serif" },
  { id: 'kopub-batang', name: 'KoPub Batang', family: "'KoPubBatang', serif" },
];

export const codeFonts: ReadonlyArray<FontEntry> = [
  { id: 'jetbrains-mono', name: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
  { id: 'd2coding', name: 'D2Coding', family: "'D2Coding', monospace" },
  { id: 'nanumgothic-coding', name: 'Nanum Gothic Coding', family: "'Nanum Gothic Coding', monospace" },
];

export const defaultBodyFontId = 'suit';
export const defaultCodeFontId = 'jetbrains-mono';

const findFont = (fonts: ReadonlyArray<FontEntry>, id: string, defaultId: string): string => {
  const found = fonts.find((f) => f.id === id);
  if (found) return found.family;
  const fallback = fonts.find((f) => f.id === defaultId);
  return fallback?.family ?? fonts[0]?.family ?? 'sans-serif';
};

export const getBodyFontFamily = (id: string): string =>
  findFont(bodyFonts, id, defaultBodyFontId);

export const getCodeFontFamily = (id: string): string =>
  findFont(codeFonts, id, defaultCodeFontId);
