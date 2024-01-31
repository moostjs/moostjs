import { All, Delete, Get, HttpMethod, Patch, Post, Put } from '../http-method.decorator'

export class HttpMethodTestClass {
  @Get('')
  root() {
    /** */
  }

  @Get('path')
  test() {
    /** */
  }

  @All()
  all() {
    /** */
  }

  @Get()
  get() {
    /** */
  }

  @Put()
  put() {
    /** */
  }

  @Post()
  post() {
    /** */
  }

  @Delete()
  delete() {
    /** */
  }

  @Patch()
  patch() {
    /** */
  }

  @HttpMethod('OPTIONS')
  options() {
    /** */
  }
}
