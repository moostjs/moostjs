<div class="file-sep">create-user.as</div>

```atscript
export interface CreateUserDto {
  @meta.example "Alice"
  @expect.minLength 2
  @expect.maxLength 100
  name: string

  @meta.example "a@b.com"
  email: string.email

  @meta.sensitive
  @expect.minLength 8
  password: string

  role?: UserRole

  address: {
    @meta.example "123 Main St"
    street: string

    @meta.example "Springfield"
    city: string

    @meta.example "62704"
    @expect.pattern /^\d{5}$/
    zip: string
  }
}
```
