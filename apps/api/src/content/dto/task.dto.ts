export class CreateTaskDto {
  unitId!: string;
  title?: string | null;
  statementLite!: string;
  answerType!: string;
  isRequired?: boolean;
  sortOrder?: number;
}

export class UpdateTaskDto {
  title?: string | null;
  statementLite?: string;
  answerType?: string;
  isRequired?: boolean;
  sortOrder?: number;
}
