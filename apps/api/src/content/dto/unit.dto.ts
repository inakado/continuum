export class CreateUnitDto {
  sectionId!: string;
  title!: string;
  sortOrder?: number;
}

export class UpdateUnitDto {
  description?: string | null;
  title?: string;
  sortOrder?: number;
  theoryRichLatex?: string | null;
  methodRichLatex?: string | null;
  videosJson?: unknown;
  attachmentsJson?: unknown;
}
