export class CreateSectionDto {
  courseId!: string;
  title!: string;
  description?: string | null;
  sortOrder?: number;
}

export class UpdateSectionDto {
  title?: string;
  description?: string | null;
  sortOrder?: number;
}
