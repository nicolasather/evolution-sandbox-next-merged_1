/** Excel-friendly gradebook CSV (UTF-8 BOM, CRLF, formula-injection safe). */
export const GRADEBOOK_HEADER = ['SessionID', 'Timestamp', 'PlayerNickname', 'TotalQuestions', 'CorrectAnswers', 'AccuracyPct', 'FinalScore', 'MaxStreak', 'RedemptionRecovered', 'MissedDiscoveryIDs'] as const;
export type GradeRow = { sessionId: string; timestamp: string; nickname: string; total: number; correct: number; finalScore: number; maxStreak: number; redemptionRecovered: number; missedIds: string[] };

export function csvCell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop Excel evaluating a cell as a formula
  return /[",\r\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function gradebookCsv(rows: readonly GradeRow[]): string {
  const lines: string[] = [GRADEBOOK_HEADER.join(',')];
  for (const r of rows) {
    const acc = r.total ? Math.round((r.correct / r.total) * 1000) / 10 : 0;
    lines.push([r.sessionId, r.timestamp, r.nickname, r.total, r.correct, acc, r.finalScore, r.maxStreak, r.redemptionRecovered, r.missedIds.join('|')].map(csvCell).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
