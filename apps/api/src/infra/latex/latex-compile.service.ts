import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  compileLatexToPdf,
  LatexRuntimeError,
} from '@continuum/latex-runtime';

type CompileResult = {
  pdfBytes: Buffer;
  logSnippet?: string;
};

@Injectable()
export class LatexCompileService {
  private readonly logger = new Logger(LatexCompileService.name);

  async compileToPdf(texSource: string): Promise<CompileResult> {
    try {
      const texBytes = Buffer.byteLength(texSource, 'utf8');
      this.logger.log(`LaTeX compile started (texBytes=${texBytes})`);
      const result = await compileLatexToPdf(texSource);
      if (result.bytes.length === 0) {
        this.logger.error('LaTeX compile produced empty PDF');
        throw new InternalServerErrorException('LaTeX compilation produced an empty PDF');
      }

      this.logger.log(`LaTeX compile succeeded (pdfBytes=${result.bytes.length})`);
      return {
        pdfBytes: result.bytes,
        ...(result.logSnippet ? { logSnippet: result.logSnippet } : null),
      };
    } catch (error) {
      if (error instanceof LatexRuntimeError) {
        if (error.code === 'INVALID_LATEX_INPUT' || error.code === 'LATEX_TOO_LARGE') {
          this.logger.warn(`LaTeX request rejected: ${error.message}`);
          throw new BadRequestException({
            code: error.code,
            message: error.message,
          });
        }

        if (error.code === 'LATEX_COMPILE_TIMEOUT' || error.code === 'LATEX_COMPILE_FAILED') {
          this.logger.error(
            `LaTeX compile failed with code ${error.code}. ${this.formatSnippetForLog(
              error.logSnippet,
            )}`,
          );
          throw new ConflictException({
            code: error.code,
            message: error.message,
            ...(error.logSnippet ? { logSnippet: error.logSnippet } : null),
          });
        }

        if (error.code === 'LATEX_RUNTIME_MISSING') {
          this.logger.error('pdflatex binary is missing in API runtime');
          throw new InternalServerErrorException(
            'pdflatex binary is not available in API runtime environment',
          );
        }
      }

      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.logger.error(`LaTeX compile crashed unexpectedly: ${this.errorMessage(error)}`);
      throw new InternalServerErrorException(
        `LaTeX compilation failed unexpectedly: ${this.errorMessage(error)}`,
      );
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return 'unknown error';
  }

  private formatSnippetForLog(snippet?: string): string {
    if (!snippet) return 'No pdflatex output captured.';
    return `pdflatex output:\n${snippet}`;
  }
}
