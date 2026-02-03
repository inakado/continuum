export class CreateUnitDto {
  sectionId!: string;
  title!: string;
  sortOrder?: number;
}

export class UpdateUnitDto {
  title?: string;
  sortOrder?: number;
}
