<div class="file-sep">create-user.dto.ts</div>

```ts
export class CreateUserDto {
  @ApiProperty({ description: 'Name', example: 'Alice', minLength: 2 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string

  @ApiProperty({ description: 'Email', example: 'a@b.com' })
  @IsEmail()
  email: string

  @ApiProperty({ description: 'Password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string

  @ApiProperty({ description: 'Role', required: false, enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  @ApiProperty({ description: 'Address', type: () => AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto
}
```

<div class="file-sep">address.dto.ts</div>

```ts
export class AddressDto {
  @ApiProperty({ example: '123 Main St' })
  @IsString()
  street: string

  @ApiProperty({ example: 'Springfield' })
  @IsString()
  city: string

  @ApiProperty({ example: '62704' })
  @IsString()
  @Matches(/^\d{5}$/)
  zip: string
}
```
