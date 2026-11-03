export class ResetPasswordDto {
  credentialType: 'ROOT' | 'ADMIN' | 'CONTROL_PANEL';
  newPassword: string;
}
