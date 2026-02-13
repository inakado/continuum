export class CreateUnitDto {
  sectionId!: string;
  title!: string;
  sortOrder?: number;
}

export class UpdateUnitDto {
  description?: string | null;
  title?: string;
  sortOrder?: number;
  minOptionalCountedTasksToComplete?: number;
  requiredTaskIds?: string[];
  theoryRichLatex?: string | null;
  theoryPdfAssetKey?: string | null;
  methodRichLatex?: string | null;
  methodPdfAssetKey?: string | null;
  videosJson?: unknown;
  attachmentsJson?: unknown;
}
