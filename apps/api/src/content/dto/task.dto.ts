export class CreateTaskDto {
  unitId!: string;
  title?: string | null;
  statementLite!: string;
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
  answerType?: string;
  numericPartsJson?: unknown;
  choicesJson?: unknown;
  correctAnswerJson?: unknown;
  solutionLite?: string | null;
  isRequired?: boolean;
  sortOrder?: number;
}
