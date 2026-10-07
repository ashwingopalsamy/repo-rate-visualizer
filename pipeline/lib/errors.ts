/** A source responded but its content did not match what the parser expects. Parsers throw this instead of returning partial data. */
export class SourceParseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SourceParseError';
  }
}
