import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

/** Log in with `identifier` (email, or a worker's username) or legacy `email`. */
export class LoginDto {
  @ApiPropertyOptional({ example: 'head@velanspaces.com', description: 'Email or username' })
  @ValidateIf((o: LoginDto) => o.email === undefined)
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  identifier?: string;

  @ApiPropertyOptional({ example: 'head@velanspaces.com', deprecated: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'secret123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class GoogleLoginDto {
  @ApiProperty({ description: 'Google ID token from the native/web Google sign-in' })
  @IsString()
  @MinLength(20)
  idToken!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt input limit used by Supabase Auth
  newPassword!: string;
}
