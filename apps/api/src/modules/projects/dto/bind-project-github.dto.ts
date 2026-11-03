import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class BindProjectGithubDto {
  @IsString()
  @IsNotEmpty()
  installationId: string;

  @IsString()
  @IsNotEmpty()
  repoFullName: string; // e.g. "owner/repo"

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message:
      'Project key must be uppercase alphanumeric (2 to 10 characters), e.g. NV, CORE, XAR',
  })
  key?: string;
}
