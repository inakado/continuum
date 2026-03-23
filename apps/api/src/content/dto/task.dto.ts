export class CreateTaskDto {
  unitId!: string;
  title?: string | null;
  statementLite!: string;
  methodGuidance?: string | null;
  answerType!: string;
  numericPartsJson?: unknown;
  choicesJson?: unknown;
  correctAnswerJson?: unknown;
  solutionLite?: string | null;
  isRequired?: boolean;
  sortOrder?: number;
}

export class UpdateTaskDto {
  title?: string | null;
  statementLite?: string;
  methodGuidance?: string | null;
  answerType?: string;
  numericPartsJson?: unknown;
  choicesJson?: unknown;
  correctAnswerJson?: unknown;
  solutionLite?: string | null;
  isRequired?: boolean;
  sortOrder?: number;
}
