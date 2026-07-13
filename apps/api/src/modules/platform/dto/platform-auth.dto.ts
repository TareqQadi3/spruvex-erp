import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class PlatformLoginDto {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
