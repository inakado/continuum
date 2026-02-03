export class CreateCourseDto {
  title!: string;
  description?: string | null;
}

export class UpdateCourseDto {
  title?: string;
  description?: string | null;
}
