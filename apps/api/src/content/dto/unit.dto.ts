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
  theoryHtmlAssetKey?: string | null;
  theoryHtmlAssetsJson?: unknown;
  methodRichLatex?: string | null;
  methodPdfAssetKey?: string | null;
  methodHtmlAssetKey?: string | null;
  methodHtmlAssetsJson?: unknown;
  videosJson?: unknown;
  attachmentsJson?: unknown;
}
