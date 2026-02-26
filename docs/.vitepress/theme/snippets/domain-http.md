```ts
@Controller('users')
export class UsersController {
  @Get(':id')
  find(@Param('id') id: string) {
    return this.db.findUser(id)
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.db.createUser(dto)
  }
}
```
