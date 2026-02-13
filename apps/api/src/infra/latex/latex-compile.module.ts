import { Module } from '@nestjs/common';
import { LatexCompileService } from './latex-compile.service';

@Module({
  providers: [LatexCompileService],
  exports: [LatexCompileService],
})
export class LatexCompileModule {}
