import { TFunction, TPrimitives } from 'common'
import { TZodMate, getZodMate } from './zod.mate'
import { z } from 'zod'
import { zodOrPrimitiveOrClass } from './validate'

const mate = getZodMate()

export const Zod = (t: TZodMate['zodType']) => mate.decorate('zodType', t)
export const Lazy = (fn: TZodMate['zodLazy']) => mate.decorate('zodLazy', fn)
export const Coerce = () => mate.decorate('zodCoerce', true)
export const IsArray = (typesfn: TZodMate['zodArray']) => mate.decorate('zodArray', typesfn)

export const Refine = (...args: Parameters<ReturnType<typeof z.string>['refine']>) => mate.decorate('zodFn', (t) => t.refine(...args), true)
export const SuperRefine = (...args: Parameters<ReturnType<typeof z.string>['superRefine']>) => mate.decorate('zodFn', (t) => t.superRefine(...args), true)
export const Trim = () => mate.decorate('zodFn', (t) => (t as z.ZodString).trim(), true)
export const Transform = (...args: Parameters<ReturnType<typeof z.string>['transform']>) => mate.decorate('zodFn', (t) => t.transform(...args), true)
export const OnCatch = <Output>(def: ((ctx: {
    error: z.ZodError
    input: unknown
}) => Output) | Output) => mate.decorate('zodFn', (t) => t.catch(...([def] as unknown as Parameters<ReturnType<typeof z.string>['catch']>)), true)

export const HasLength = (...args: Parameters<ReturnType<typeof z.string>['length']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).length(...args), true)
export const Min = (...args: Parameters<ReturnType<typeof z.string>['min']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).min(...args), true)
export const Max = (...args: Parameters<ReturnType<typeof z.string>['max']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).max(...args), true)
export const DateFrom = (...args: Parameters<ReturnType<typeof z.date>['min']>) => mate.decorate('zodFn', (t) => (t as z.ZodDate).min(...args), true)
export const DateTo = (...args: Parameters<ReturnType<typeof z.date>['max']>) => mate.decorate('zodFn', (t) => (t as z.ZodDate).max(...args), true)

export const IsNullable = () => mate.decorate('zodFn', (t) => t.nullable(), true)
export const IsNullish = () => mate.decorate('zodFn', (t) => t.nullish(), true)

// strings
export const IsEmail = (...args: Parameters<ReturnType<typeof z.string>['email']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).email(...args), true)
export const IsUrl = (...args: Parameters<ReturnType<typeof z.string>['url']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).url(...args), true)
export const IsEmoji = (...args: Parameters<ReturnType<typeof z.string>['emoji']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).emoji(...args), true)
export const IsUuid = (...args: Parameters<ReturnType<typeof z.string>['uuid']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).uuid(...args), true)
export const IsCuid = (...args: Parameters<ReturnType<typeof z.string>['cuid']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).cuid(...args), true)
export const IsCuid2 = (...args: Parameters<ReturnType<typeof z.string>['cuid2']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).cuid2(...args), true)
export const IsUlid = (...args: Parameters<ReturnType<typeof z.string>['ulid']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).ulid(...args), true)
export const IsDatetime = (...args: Parameters<ReturnType<typeof z.string>['datetime']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).datetime(...args), true)
export const IsIp = (...args: Parameters<ReturnType<typeof z.string>['ip']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).ip(...args), true)

export const MatchesRegex = (...args: Parameters<ReturnType<typeof z.string>['regex']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).regex(...args), true)
export const StartsWith = (...args: Parameters<ReturnType<typeof z.string>['startsWith']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).startsWith(...args), true)
export const EndsWith = (...args: Parameters<ReturnType<typeof z.string>['endsWith']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).endsWith(...args), true)

// numbers
export const IsGt = (...args: Parameters<ReturnType<typeof z.number>['gt']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).gt(...args), true)
export const IsGte = (...args: Parameters<ReturnType<typeof z.number>['gte']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).gte(...args), true)
export const IsLt = (...args: Parameters<ReturnType<typeof z.number>['lt']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).lt(...args), true)
export const IsLte = (...args: Parameters<ReturnType<typeof z.number>['lte']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).lte(...args), true)
export const IsInt = (...args: Parameters<ReturnType<typeof z.number>['int']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).int(...args), true)
export const IsPositive = (...args: Parameters<ReturnType<typeof z.number>['positive']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).positive(...args), true)
export const IsNonnegative = (...args: Parameters<ReturnType<typeof z.number>['nonnegative']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).nonnegative(...args), true)
export const IsNegative = (...args: Parameters<ReturnType<typeof z.number>['negative']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).negative(...args), true)
export const IsNonpositive = (...args: Parameters<ReturnType<typeof z.number>['nonpositive']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).nonpositive(...args), true)
export const IsMultipleOf = (...args: Parameters<ReturnType<typeof z.number>['multipleOf']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).multipleOf(...args), true)
export const IsFinite = (...args: Parameters<ReturnType<typeof z.number>['finite']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).finite(...args), true)
export const IsSafeNumber = (...args: Parameters<ReturnType<typeof z.number>['safe']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).safe(...args), true)

//
export const Includes = (...args: Parameters<ReturnType<typeof z.string>['includes']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).includes(...args), true)

// type primitives
export const IsString = (...args: Parameters<typeof z.string>) => Zod(z.string(...args))
export const IsNumber = (...args: Parameters<typeof z.number>) => Zod(z.number(...args))
export const IsBigint = (...args: Parameters<typeof z.bigint>) => Zod(z.bigint(...args))
export const IsBoolean = (...args: Parameters<typeof z.boolean>) => Zod(z.boolean(...args))
export const IsDate = (...args: Parameters<typeof z.date>) => Zod(z.date(...args))
export const IsSymbol = (...args: Parameters<typeof z.symbol>) => Zod(z.symbol(...args))
export const IsUndefined = (...args: Parameters<typeof z.undefined>) => Zod(z.undefined(...args))
export const IsNull = (...args: Parameters<typeof z.null>) => Zod(z.null(...args))
export const IsVoid = (...args: Parameters<typeof z.void>) => Zod(z.void(...args))
export const IsAny = (...args: Parameters<typeof z.any>) => Zod(z.any(...args))
export const IsUnknown = (...args: Parameters<typeof z.unknown>) => Zod(z.unknown(...args))
export const IsNever = (...args: Parameters<typeof z.never>) => Zod(z.never(...args))

// advanced types
export const IsEnum = (...args: Parameters<typeof z.enum>) => Zod(z.enum(...args))
export const IsNativeEnum = (...args: Parameters<typeof z.nativeEnum>) => Zod(z.nativeEnum(...args))
export const IsSet = (type: TFunction | z.ZodType | TPrimitives) => Zod(z.set(zodOrPrimitiveOrClass(type)))
export const IsMap = (type: TFunction | z.ZodType | TPrimitives, type2: TFunction | z.ZodType | TPrimitives) => Zod(z.map(zodOrPrimitiveOrClass(type), zodOrPrimitiveOrClass(type2)))
export const IsLiteral = (...args: Parameters<typeof z.literal>) => Zod(z.literal(...args))
export const IsNaN = (...args: Parameters<typeof z.nan>) => Zod(z.nan(...args))
export const IsRecord = (type: TFunction | z.ZodType | TPrimitives, type2?: TFunction | z.ZodType | TPrimitives) => Zod(z.record(zodOrPrimitiveOrClass(type), type2 ? zodOrPrimitiveOrClass(type2) : undefined))
export const IsUnion = (...types: [(TFunction | z.ZodType | TPrimitives), (TFunction | z.ZodType | TPrimitives), ...(TFunction | z.ZodType | TPrimitives)[]]) => Zod(
    z.union(
        types.map(t => zodOrPrimitiveOrClass(t)) as unknown as (readonly [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]])
    )
)
export const IsDiscriminatedUnion = (discriminator: string, options: [(TFunction | z.ZodType | TPrimitives), (TFunction | z.ZodType | TPrimitives), ...(TFunction | z.ZodType | TPrimitives)[]]) => Zod(
    z.discriminatedUnion(
        discriminator,
        options.map(t => zodOrPrimitiveOrClass(t)) as unknown as [z.ZodDiscriminatedUnionOption<string>, z.ZodDiscriminatedUnionOption<string>, ...z.ZodDiscriminatedUnionOption<string>[]],
    )
)
export const IsIntersection = (left: (TFunction | z.ZodType | TPrimitives), right: (TFunction | z.ZodType | TPrimitives)) => Zod(
    z.intersection(zodOrPrimitiveOrClass(left), zodOrPrimitiveOrClass(right))
)
export const IsPromise = (type: TFunction | z.ZodType | TPrimitives) => Zod(z.promise(zodOrPrimitiveOrClass(type)))
export const IsPreprocessed = <T>(fn: ((arg: unknown) => T), type: TFunction | z.ZodType | TPrimitives) => Zod(z.preprocess(fn, zodOrPrimitiveOrClass(type)))
export const IsCustom = (...args: Parameters<typeof z.custom>) => Zod(z.custom(...args))

// unions/intersections
export const And = (type: TFunction | z.ZodType | TPrimitives) => mate.decorate('zodFn', (t) => t.and(zodOrPrimitiveOrClass(type)), true)
export const Or = (type: TFunction | z.ZodType | TPrimitives) => mate.decorate('zodFn', (t) => t.or(zodOrPrimitiveOrClass(type)), true)
