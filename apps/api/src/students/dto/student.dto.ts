export class CreateStudentDto {
  login!: string;
  firstName?: string | null;
  lastName?: string | null;
}

export class TransferStudentDto {
  leaderTeacherId!: string;
}

export class UpdateStudentProfileDto {
  firstName?: string | null;
  lastName?: string | null;
}
