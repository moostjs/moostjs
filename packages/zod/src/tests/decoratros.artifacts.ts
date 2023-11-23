import { z } from 'zod'
import {
    Zod,
    LazyType,
    Coerce,
    IsArray,
    Refine,
    SuperRefine,
    Trim,
    Transform,
    OnCatch,
    HasLength,
    Min,
    Max,
    DateFrom,
    DateTo,
    IsNullable,
    IsNullish,
    IsEmail,
    IsUrl,
    IsEmoji,
    IsUuid,
    IsCuid,
    IsCuid2,
    IsUlid,
    IsDatetime,
    IsIp,
    MatchesRegex,
    StartsWith,
    EndsWith,
    IsGt,
    IsGte,
    IsLt,
    IsLte,
    IsInt,
    IsPositive,
    IsNonnegative,
    IsNegative,
    IsNonpositive,
    IsMultipleOf,
    IsFinite,
    IsSafeNumber,
    Includes,
    IsString,
    IsNumber,
    IsBigint,
    IsBoolean,
    IsDate,
    IsSymbol,
    IsUndefined,
    IsNull,
    IsVoid,
    IsAny,
    IsUnknown,
    // IsNever,
    IsEnum,
    IsNativeEnum,
    IsSet,
    IsMap,
    IsLiteral,
    IsNaN,
    IsRecord,
    IsUnion,
    IsDiscriminatedUnion,
    IsIntersection,
    IsPromise,
    Preprocess,
    IsCustom,
    And,
    Or,
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

    @Refine((value) => value === 'admin')
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
    @Transform((value) => value.toUpperCase())
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

    @IsDiscriminatedUnion(
        'type', [
            z.object({ type: z.literal('A'), value: z.string() }),
            z.object({ type: z.literal('B'), value: z.number() }),
        ],
    )
    discriminatedUnionType!: { type: 'A', value: string } | { type: 'B', value: number }

    @IsIntersection(
        z.object({ prop1: z.string() }),
        z.object({ prop2: z.number() }),
    )
    intersectionType!: { prop1: string } & { prop2: number }

    @IsPromise(z.string())
    promiseType!: Promise<string>

    @Preprocess((value: unknown) => String(value))
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
