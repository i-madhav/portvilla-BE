import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { PDFParse } from 'pdf-parse';

/**
 * Pulls plain text out of an uploaded resume PDF.
 *
 * The only place `pdf-parse` is imported, so swapping the PDF library — or
 * moving extraction off the request path entirely — is a change to this file
 * alone.
 *
 * Extraction is best-effort by design: a scanned or image-only resume yields no
 * text, and that is a normal outcome, not an error. Every failure returns null
 * and the upload still succeeds, because the stored file is worth keeping
 * whether or not text came out of it.
 */
@Injectable()
export class ResumeTextExtractor {
  private readonly logger = new Logger(ResumeTextExtractor.name);

  /**
   * Cap on stored text. A resume past this length is padding, and the whole
   * string is later spent as LLM input and read by the agent.
   */
  private static readonly MAX_PARSED_TEXT = 20000;

  async extract(file: Express.Multer.File): Promise<string | null> {
    try {
      const buffer = await readFile(file.path);
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        const text = result.text.trim();
        return text ? text.slice(0, ResumeTextExtractor.MAX_PARSED_TEXT) : null;
      } finally {
        await parser.destroy();
      }
    } catch (err) {
      this.logger.warn(
        `extract: could not read PDF — ${(err as Error).message}`,
      );
      return null;
    }
  }
}
