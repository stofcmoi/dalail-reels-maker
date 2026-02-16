export type DalailSentence = { id: string; index: number; text: string; translation?: string | null };
export type DalailPart = { part: number; title: string; sentences: DalailSentence[]; sourceUrl: string };

export type Reader = {
  id: string;
  name: string;
  audioParts: Record<string, string>; // "1".."8" => mp3 url
};

export type TimingItem = { sentenceId: string; startSec: number; endSec: number };
export type TimingsFile = { readerId: string; part: number; items: TimingItem[]; version: number; createdAt: string };
