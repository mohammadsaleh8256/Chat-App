import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'نام الزامی است.' })
  @MaxLength(64)
  firstName!: string;

  @IsString()
  @IsNotEmpty({ message: 'نام خانوادگی الزامی است.' })
  @MaxLength(64)
  lastName!: string;

  @IsString()
  @IsNotEmpty({ message: 'شماره تلفن الزامی است.' })
  @Matches(/^(\+?98|0)?9\d{9}$/, { message: 'شماره موبایل معتبر نیست.' })
  phoneNumber!: string;

  @IsString()
  @MinLength(6, { message: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' })
  @MaxLength(128)
  password!: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'شماره تلفن الزامی است.' })
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty({ message: 'رمز عبور الزامی است.' })
  password!: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
