export class AppError extends Error {
  status: number;
  /** Which of the five answer-verification stages rejected the request (1–5), when applicable. */
  stage?: number;
  constructor(message: string, status = 400, stage?: number) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.stage = stage;
  }
}
