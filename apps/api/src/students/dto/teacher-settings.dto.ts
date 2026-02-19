export class UpdateTeacherProfileDto {
  firstName!: string;
  lastName!: string;
  middleName?: string | null;
}

export class ChangeTeacherPasswordDto {
  currentPassword!: string;
  newPassword!: string;
}

export class CreateTeacherDto {
  login!: string;
  firstName!: string;
  lastName!: string;
  middleName?: string | null;
  password?: string | null;
  generatePassword?: boolean;
}
