export class CreateSectionDto {
  courseId!: string;
  title!: string;
  sortOrder?: number;
}

export class UpdateSectionDto {
  title?: string;
  sortOrder?: number;
}
