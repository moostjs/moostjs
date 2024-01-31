/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-invalid-void-type */
import { z } from 'zod'

import {
  And,
  Coerce,
  DateFrom,
  DateTo,
  EndsWith,
  HasLength,
  Includes,
  IsAny,
  IsArray,
  IsBigint,
  IsBoolean,
  IsCuid,
  IsCuid2,
  IsCustom,
  IsDate,
  IsDatetime,
  IsDiscriminatedUnion,
  IsEmail,
  IsEmoji,
  // IsNever,
  IsEnum,
  IsFinite,
  IsGt,
  IsGte,
  IsInt,
  IsIntersection,
  IsIp,
  IsLiteral,
  IsLt,
  IsLte,
  IsMap,
  IsMultipleOf,
  IsNaN,
  IsNativeEnum,
  IsNegative,
  IsNonnegative,
  IsNonpositive,
  IsNull,
  IsNullable,
  IsNullish,
  IsNumber,
  IsPositive,
  IsPromise,
  IsRecord,
  IsSafeNumber,
  IsSet,
  IsString,
  IsSymbol,
  IsUlid,
  IsUndefined,
  IsUnion,
  IsUnknown,
  IsUrl,
  IsUuid,
  IsVoid,
  LazyType,
  MatchesRegex,
  Max,
  Min,
  OnCatch,
  Or,
  Preprocess,
  Refine,
  StartsWith,
  SuperRefine,
  Transform,
  Trim,
  Zod,
} from '../zod.decorators'

enum Color {
  Red = 'RED',
  Green = 'GREEN',
  Blue = 'BLUE',
}

export class ValidoDecoratorsTestClass {
  @Zod(z.string())
  name!: string

  @LazyType(() => Number)
  age!: number

  @Coerce()
  @IsString()
  @IsArray()
  tags!: string[]

  @Refine(value => value === 'admin')
  role!: 'admin'

  @SuperRefine((value, ctx) => {
    if (value !== 'user') {
      ctx.addIssue({
        code: 'custom',
        message: 'must be "user"',
      })
    }
    return Promise.resolve()
  })
  role2!: 'user'

  @Trim()
  @Transform(value => (value as string).toUpperCase())
  upperName!: string

  @OnCatch(() => 'default')
  catchExample!: string

  @HasLength(5)
  fixedLengthString!: string

  @Min(0)
  @Max(100)
  limitedNumber!: number

  @IsDate()
  @DateFrom(new Date(2000, 0, 1))
  fromDate!: Date

  @IsDate()
  @DateTo(new Date(2023, 0, 1))
  toDate!: Date

  @IsString()
  @IsNullable()
  nullableValue!: string | null

  @IsString()
  @IsNullish()
  nullishValue!: string | null | undefined

  @IsEmail()
  email!: string

  @IsUrl()
  url!: string

  @IsEmoji()
  emoji!: string

  @IsUuid()
  uuid!: string

  @IsCuid()
  cuid!: string

  @IsCuid2()
  cuid2!: string

  @IsUlid()
  ulid!: string

  @IsDatetime()
  datetime!: string

  @IsIp()
  ip!: string

  @MatchesRegex(/^[A-Z]+$/)
  uppercase!: string

  @StartsWith('Hello')
  startsWithHello!: string

  @EndsWith('World')
  endsWithWorld!: string

  @IsGt(10)
  greaterThanTen!: number

  @IsGte(20)
  greaterThanOrEqualToTwenty!: number

  @IsLt(30)
  lessThanThirty!: number

  @IsLte(40)
  lessThanOrEqualToForty!: number

  @IsInt()
  integer!: number

  @IsPositive()
  positiveNumber!: number

  @IsNonnegative()
  nonNegativeNumber!: number

  @IsNegative()
  negativeNumber!: number

  @IsNonpositive()
  nonPositiveNumber!: number

  @IsMultipleOf(5)
  multipleOfFive!: number

  @IsFinite()
  finiteNumber!: number

  @IsSafeNumber()
  safeNumber!: number

  @Includes('world')
  includesWorld!: string

  @IsString()
  stringType!: string

  @IsNumber()
  numberType!: number

  @IsBigint()
  bigintType!: bigint

  @IsBoolean()
  booleanType!: boolean

  @IsDate()
  dateType!: Date

  @IsSymbol()
  symbolType!: symbol

  @IsUndefined()
  undefinedType!: undefined

  @IsNull()
  nullType!: null

  @IsVoid()
  voidType!: void

  @IsAny()
  anyType!: any

  @IsUnknown()
  unknownType!: unknown

  // @IsNever()
  // neverType!: never

  @IsEnum(['A', 'B', 'C'])
  enumType!: 'A' | 'B' | 'C'

  @IsNativeEnum(Color)
  nativeEnumType!: Color

  @IsSet(String)
  setType!: Set<string>

  @IsMap(String, Number)
  mapType!: Map<string, number>

  @IsLiteral('literal')
  literalType!: 'literal'

  @IsNaN()
  nanType!: number

  @IsRecord(String, Number)
  recordType!: Record<string, number>

  @IsUnion(String, Number)
  unionType!: string | number

  @IsDiscriminatedUnion('type', [
    z.object({ type: z.literal('A'), value: z.string() }),
    z.object({ type: z.literal('B'), value: z.number() }),
  ])
  discriminatedUnionType!: { type: 'A'; value: string } | { type: 'B'; value: number }

  @IsIntersection(z.object({ prop1: z.string() }), z.object({ prop2: z.number() }))
  intersectionType!: { prop1: string } & { prop2: number }

  @IsPromise(z.string())
  promiseType!: Promise<string>

  @Preprocess(String)
  preprocessedType!: string

  @IsCustom((value: unknown) => value === 'custom')
  customType!: 'custom'

  @Zod(z.object({ prop1: z.string() }))
  @And(z.object({ prop2: z.number() }))
  andType!: { prop1: string } & { prop2: number }

  @Zod(z.object({ prop1: z.string() }))
  @Or(z.object({ prop2: z.number() }))
  orType!: { prop1: string } | { prop2: number }
}
