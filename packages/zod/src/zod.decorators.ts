import { TFunction, TPrimitives } from 'common'
import { TZodMate, getZodMate } from './zod.mate'
import { z } from 'zod'
import { getZodType } from './validate'
import { TZodOpts, resolveZodPrimitive } from './primitives'

const mate = getZodMate()

/**
 * Decorator to specify the Zod type for a property https://zod.dev/?id=basic-usage
 * @param type - The Zod type
 */
export const Zod = (type: TZodMate['zodType']) => mate.decorate('zodType', type)

/**
 * Decorator to lazily specify the Zod type for a property, use when have recursive or circular deps https://zod.dev/?id=recursive-types
 * @param fn - A function that returns the Zod type
 */
export const LazyType = <T extends (TFunction | z.ZodType)>(getter: () => T, opts?: Parameters<typeof z.lazy>[1]) => Zod((_opts) => z.lazy(() => toZodType(getter()), { ...(opts || {}), ...(_opts || {}) }))

/**
 * Decorator to enable coercion for a property https://zod.dev/?id=coercion-for-primitives
 */
export const Coerce = () => mate.decorate('zodCoerce', true)

/**
 * Decorator to define default value for ZodType
 */
export const Default = (value: unknown) => mate.decorate('zodDefault', value)

/**
 * Decorator to specify that the property should be an array https://zod.dev/?id=arrays or tuple https://zod.dev/?id=tuples
 * @param typesfn - A function that returns an array of Zod types
 */
export const IsArray = (types?: (TFunction | z.ZodType | TPrimitives) | (TFunction | z.ZodType | TPrimitives)[], opts?: { coerce?: true }) => {
    const decorators = [
        mate.decorate('zodFn', (t) => t.array(), true),
        mate.decorate('zodMarkedAsArray', true),
        mate.decorate((meta) => {
            if (meta.optional) {
                meta.zodMarkedAsArrayBeforeOptional = true
            }
            return meta
        }),
    ]
    if (types) {
        if (Array.isArray(types)) {
            if (types.length > 1) {
                const zodType = z.union(types.map(t => toZodType(t, opts)) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]])
                decorators.push(Zod(zodType))
            } else if (types.length === 1) {
                decorators.push(Zod(toZodType(types[0], opts)))
            }
        } else {
            decorators.push(Zod(toZodType(types, opts)))
        }
    }
    return mate.apply(...decorators)
}

/**
 * Decorator to refine the Zod type with additional constraints https://zod.dev/?id=refine
 * @param args - Arguments for the `refine` method of Zod type
 */
export const Refine = (...args: Parameters<ReturnType<typeof z.string>['refine']>) => mate.decorate('zodFn', (t) => t.refine(...args), true)

/**
 * Decorator to super refine the Zod type with additional constraints https://zod.dev/?id=superrefine
 * @param args - Arguments for the `superRefine` method of Zod type
 */
export const SuperRefine = (...args: Parameters<ReturnType<typeof z.string>['superRefine']>) => mate.decorate('zodFn', (t) => t.superRefine(...args), true)

/**
 * Decorator to trim the value https://zod.dev/?id=strings
 */
export const Trim = () => mate.decorate('zodFn', (t) => (t as z.ZodString).trim(), true)

/**
 * Decorator to transform the Zod type with a transformation function https://zod.dev/?id=transform
 * @param args - Arguments for the `transform` method of Zod string type
 */
export const Transform = (...args: Parameters<ReturnType<typeof z.string>['transform']>) => mate.decorate('zodFn', (t) => t.transform(...args), true)

/**
 * Decorator to handle errors during parsing or validating the Zod type https://zod.dev/?id=catch
 * @param def - Default value or error handler function
 */
export const OnCatch = <Output>(def: ((ctx: {
    error: z.ZodError
    input: unknown
}) => Output) | Output) => mate.decorate('zodFn', (t) => t.catch(...([def] as unknown as Parameters<ReturnType<typeof z.string>['catch']>)), true)

/**
 * Decorator to specify that the Zod type should have a specific length
 * @param args - Arguments for the `length` method of Zod type
 */
export const HasLength = (...args: Parameters<ReturnType<typeof z.string>['length']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).length(...args), true)

/**
 * Decorator to specify the minimum value for the Zod type
 * @param args - Arguments for the `min` method of Zod type
 */
export const Min = (...args: Parameters<ReturnType<typeof z.string>['min']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).min(...args), true)

/**
 * Decorator to specify the maximum value for the Zod type
 * @param args - Arguments for the `max` method of Zod type
 */
export const Max = (...args: Parameters<ReturnType<typeof z.string>['max']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).max(...args), true)

/**
 * Decorator to specify the minimum date for the Zod date type
 * @param args - Arguments for the `min` method of Zod date type
 */
export const DateFrom = (...args: Parameters<ReturnType<typeof z.date>['min']>) => mate.decorate('zodFn', (t) => (t as z.ZodDate).min(...args), true)

/**
 * Decorator to specify the maximum date for the Zod date type
 * @param args - Arguments for the `max` method of Zod date type
 */
export const DateTo = (...args: Parameters<ReturnType<typeof z.date>['max']>) => mate.decorate('zodFn', (t) => (t as z.ZodDate).max(...args), true)

/**
 * Decorator to specify that the Zod type can be nullable https://zod.dev/?id=nullable
 */
export const IsNullable = () => mate.decorate('zodFn', (t) => t.nullable(), true)

/**
 * Decorator to specify that the Zod type can be nullish (null | undefined) https://zod.dev/?id=nullish
 */
export const IsNullish = () => mate.decorate('zodFn', (t) => t.nullish(), true)

// strings
/**
 * Decorator to specify that the Zod string type is a valid email address https://zod.dev/?id=strings
 * @param args - Arguments for the `email` method of Zod string type
 */
export const IsEmail = (...args: Parameters<ReturnType<typeof z.string>['email']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).email(...args), true)

/**
 * Decorator to specify that the Zod string type is a valid URL https://zod.dev/?id=strings
 * @param args - Arguments for the `url` method of Zod string type
 */
export const IsUrl = (...args: Parameters<ReturnType<typeof z.string>['url']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).url(...args), true)

/**
 * Decorator to specify that the Zod string type is a valid emoji. https://zod.dev/?id=strings
 * @param args - Arguments for the `emoji` method of Zod string type.
 */
export const IsEmoji = (...args: Parameters<ReturnType<typeof z.string>['emoji']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).emoji(...args), true)

/**
 * Decorator to specify that the Zod string type is a valid UUID https://zod.dev/?id=strings
 * @param args - Arguments for the `uuid` method of Zod string type
 */
export const IsUuid = (...args: Parameters<ReturnType<typeof z.string>['uuid']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).uuid(...args), true)

/**
 * Decorator to specify that the Zod string type is a valid CUID https://zod.dev/?id=strings
 * @param args - Arguments for the `cuid` method of Zod string type
 */
export const IsCuid = (...args: Parameters<ReturnType<typeof z.string>['cuid']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).cuid(...args), true)

/**
 * Decorator to specify that the Zod string type is a valid CUID version 2 https://zod.dev/?id=strings
 * @param args - Arguments for the `cuid2` method of Zod string type
 */
export const IsCuid2 = (...args: Parameters<ReturnType<typeof z.string>['cuid2']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).cuid2(...args), true)

/**
 * Decorator to specify that the Zod string type is a valid ULID https://zod.dev/?id=strings
 * @param args - Arguments for the `ulid` method of Zod string type
 */
export const IsUlid = (...args: Parameters<ReturnType<typeof z.string>['ulid']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).ulid(...args), true)

/**
 * Decorator to specify that the Zod string type is a valid datetime string https://zod.dev/?id=strings
 * @param args - Arguments for the `datetime` method of Zod string type
 */
export const IsDatetime = (...args: Parameters<ReturnType<typeof z.string>['datetime']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).datetime(...args), true)

/**
 * Decorator to specify that the Zod string type is a valid IP address https://zod.dev/?id=strings
 * @param args - Arguments for the `ip` method of Zod string type
 */
export const IsIp = (...args: Parameters<ReturnType<typeof z.string>['ip']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).ip(...args), true)

/**
 * Decorator to specify that the Zod string type should match a specific regular expression https://zod.dev/?id=strings
 * @param args - Arguments for the `regex` method of Zod string type
 */
export const MatchesRegex = (...args: Parameters<ReturnType<typeof z.string>['regex']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).regex(...args), true)

/**
 * Decorator to specify that the Zod string type should start with a specific substring https://zod.dev/?id=strings
 * @param args - Arguments for the `startsWith` method of Zod string type
 */
export const StartsWith = (...args: Parameters<ReturnType<typeof z.string>['startsWith']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).startsWith(...args), true)

/**
 * Decorator to specify that the Zod string type should end with a specific substring https://zod.dev/?id=strings
 * @param args - Arguments for the `endsWith` method of Zod string type
 */
export const EndsWith = (...args: Parameters<ReturnType<typeof z.string>['endsWith']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).endsWith(...args), true)

/**
 * NUMBERS
 */

/**
 * Decorator to specify that the Zod number type should be greater than a specific value.
 * @param args - Arguments for the `gt` method of Zod number type.
 */
export const IsGt = (...args: Parameters<ReturnType<typeof z.number>['gt']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).gt(...args), true)

/**
 * Decorator to specify that the Zod number type should be greater than or equal to a specific value.
 * @param args - Arguments for the `gte` method of Zod number type.
 */
export const IsGte = (...args: Parameters<ReturnType<typeof z.number>['gte']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).gte(...args), true)

/**
 * Decorator to specify that the Zod number type should be less than a specific value.
 * @param args - Arguments for the `lt` method of Zod number type.
 */
export const IsLt = (...args: Parameters<ReturnType<typeof z.number>['lt']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).lt(...args), true)

/**
 * Decorator to specify that the Zod number type should be less than or equal to a specific value.
 * @param args - Arguments for the `lte` method of Zod number type.
 */
export const IsLte = (...args: Parameters<ReturnType<typeof z.number>['lte']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).lte(...args), true)

/**
 * Decorator to specify that the Zod number type should be an integer.
 * @param args - Arguments for the `int` method of Zod number type.
 */
export const IsInt = (...args: Parameters<ReturnType<typeof z.number>['int']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).int(...args), true)

/**
 * Decorator to specify that the Zod number type should be positive.
 * @param args - Arguments for the `positive` method of Zod number type.
 */
export const IsPositive = (...args: Parameters<ReturnType<typeof z.number>['positive']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).positive(...args), true)

/**
 * Decorator to specify that the Zod number type should be nonnegative.
 * @param args - Arguments for the `nonnegative` method of Zod number type.
 */
export const IsNonnegative = (...args: Parameters<ReturnType<typeof z.number>['nonnegative']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).nonnegative(...args), true)

/**
 * Decorator to specify that the Zod number type should be negative.
 * @param args - Arguments for the `negative` method of Zod number type.
 */
export const IsNegative = (...args: Parameters<ReturnType<typeof z.number>['negative']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).negative(...args), true)

/**
 * Decorator to specify that the Zod number type should be nonpositive.
 * @param args - Arguments for the `nonpositive` method of Zod number type.
 */
export const IsNonpositive = (...args: Parameters<ReturnType<typeof z.number>['nonpositive']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).nonpositive(...args), true)

/**
 * Decorator to specify that the Zod number type should be a multiple of a specific value.
 * @param args - Arguments for the `multipleOf` method of Zod number type.
 */
export const IsMultipleOf = (...args: Parameters<ReturnType<typeof z.number>['multipleOf']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).multipleOf(...args), true)

/**
 * Decorator to specify that the Zod number type should be finite.
 * @param args - Arguments for the `finite` method of Zod number type.
 */
export const IsFinite = (...args: Parameters<ReturnType<typeof z.number>['finite']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).finite(...args), true)

/**
 * Decorator to specify that the Zod number type should be a safe number.
 * @param args - Arguments for the `safe` method of Zod number type.
 */
export const IsSafeNumber = (...args: Parameters<ReturnType<typeof z.number>['safe']>) => mate.decorate('zodFn', (t) => (t as z.ZodNumber).safe(...args), true)

/**
 * Decorator to specify that the Zod type should include a specific item (substring)
 * @param args - Arguments for the `includes` method of Zod type
 */
export const Includes = (...args: Parameters<ReturnType<typeof z.string>['includes']>) => mate.decorate('zodFn', (t) => (t as z.ZodString).includes(...args), true)

/**
 * TYPE PRIMITIVES
 */

/**
 * Decorator to specify that the value should be a string.
 * @param args - Arguments for the `string` method of Zod.
 * @returns Zod Type decorator
 */
export const IsString = (...args: Parameters<typeof z.string>) => Zod((opts) => z.string(...(opts ? [{ ...args[0], ...opts }, ...args.slice(1)] : args)))

/**
 * Decorator to specify that the value should be a number.
 * @param args - Arguments for the `number` method of Zod.
 * @returns Zod Type decorator
 */
export const IsNumber = (...args: Parameters<typeof z.number>) => Zod((opts) => z.number(...(opts ? [{ ...args[0], ...opts }, ...args.slice(1)] : args)))

/**
 * Decorator to specify that the value should be a bigint.
 * @param args - Arguments for the `bigint` method of Zod.
 * @returns Zod Type decorator
 */
export const IsBigint = (...args: Parameters<typeof z.bigint>) => Zod((opts) => z.bigint(...(opts ? [{ ...args[0], ...opts }, ...args.slice(1)] : args)))

/**
 * Decorator to specify that the value should be a boolean.
 * @param args - Arguments for the `boolean` method of Zod.
 * @returns Zod Type decorator
 */
export const IsBoolean = (...args: Parameters<typeof z.boolean>) => Zod((opts) => z.boolean(...(opts ? [{ ...args[0], ...opts }, ...args.slice(1)] : args)))

/**
 * Decorator to specify that the value should be a date.
 * @param args - Arguments for the `date` method of Zod.
 * @returns Zod Type decorator
 */
export const IsDate = (...args: Parameters<typeof z.date>) => Zod((opts) => z.date(...(opts ? [{ ...args[0], ...opts }, ...args.slice(1)] : args)))

/**
 * Decorator to specify that the value should be a symbol.
 * @param args - Arguments for the `symbol` method of Zod.
 * @returns Zod Type decorator
 */
export const IsSymbol = (...args: Parameters<typeof z.symbol>) => Zod((opts) => z.symbol(...(opts ? [{ ...args[0], ...opts }, ...args.slice(1)] : args)))

/**
 * Decorator to specify that the value should be undefined.
 * @param args - Arguments for the `undefined` method of Zod.
 * @returns Zod Type decorator
 */
export const IsUndefined = (...args: Parameters<typeof z.undefined>) => Zod((opts) => z.undefined(...(opts ? [{ ...args[0], ...opts }, ...args.slice(1)] : args)))

/**
 * Decorator to specify that the value should be null.
 * @param args - Arguments for the `null` method of Zod.
 * @returns Zod Type decorator
 */
export const IsNull = (...args: Parameters<typeof z.null>) => Zod((opts) => z.null(...(opts ? [{ ...args[0], ...opts }, ...args.slice(1)] : args)))

/**
 * Decorator to specify that the value should be void.
 * @param args - Arguments for the `void` method of Zod.
 * @returns Zod Type decorator
 */
export const IsVoid = (...args: Parameters<typeof z.void>) => Zod((opts) => z.void(...(opts ? [{ ...args[0], ...opts }, ...args.slice(1)] : args)))

/**
 * Decorator to specify that the value can be any type.
 * @param args - Arguments for the `any` method of Zod.
 * @returns Zod Type decorator
 */
export const IsAny = (...args: Parameters<typeof z.any>) => Zod((opts) => z.any(...(opts ? [{ ...args[0], ...opts }, ...args.slice(1)] : args)))

/**
 * Decorator to specify that the value should be an unknown type.
 * @param args - Arguments for the `unknown` method of Zod.
 * @returns Zod Type decorator
 */
export const IsUnknown = (...args: Parameters<typeof z.unknown>) => Zod((opts) => z.unknown(...(opts ? [{ ...args[0], ...opts }, ...args.slice(1)] : args)))

/**
 * Decorator to specify that the value should be a never type.
 * @param args - Arguments for the `never` method of Zod.
 * @returns Zod Type decorator
 */
export const IsNever = (...args: Parameters<typeof z.never>) => Zod((opts) => z.never(...(opts ? [{ ...args[0], ...opts }, ...args.slice(1)] : args)))

/**
 * ADVANCED TYPES
 */

/**
 * Decorator to specify that the value should be a Tuple type https://zod.dev/?id=tuples
 * @param args - Arguments for the `tuple` method of Zod
 * @returns Zod Type decorator
 */
export const IsTuple = (schemas: (TFunction | z.ZodType | TPrimitives)[]) => Zod(z.tuple(schemas.map(s => toZodType(s)) as [z.ZodTypeAny, ...z.ZodTypeAny[]]))

/**
 * Decorator to specify that the value should be an enum type.
 * @param args - Arguments for the `enum` method of Zod.
 * @returns Zod Type decorator
 */
export const IsEnum = (...args: Parameters<typeof z.enum>) => Zod(z.enum(...args))

/**
 * Decorator to specify that the value should be a native enum type.
 * @param args - Arguments for the `nativeEnum` method of Zod.
 * @returns Zod Type decorator
 */
export const IsNativeEnum = (...args: Parameters<typeof z.nativeEnum>) => Zod(z.nativeEnum(...args))

/**
 * Decorator to specify that the value should be a set.
 * @param type - The type of items in the set.
 * @returns Zod Type decorator
 */
export const IsSet = (type: TFunction | z.ZodType | TPrimitives) => Zod(z.set(toZodType(type)))

/**
 * Decorator to specify that the value should be a map.
 * @param type - The type of keys in the map.
 * @param type2 - The type of values in the map.
 * @returns Zod Type decorator
 */
export const IsMap = (type: TFunction | z.ZodType | TPrimitives, type2: TFunction | z.ZodType | TPrimitives) => Zod(z.map(toZodType(type), toZodType(type2)))

/**
 * Decorator to specify that the value should be a literal.
 * @param args - Arguments for the `literal` method of Zod.
 * @returns Zod Type decorator
 */
export const IsLiteral = (...args: Parameters<typeof z.literal>) => Zod(z.literal(...args))

/**
 * Decorator to specify that the value should be NaN.
 * @param args - Arguments for the `nan` method of Zod.
 * @returns Zod Type decorator
 */
export const IsNaN = (...args: Parameters<typeof z.nan>) => Zod(z.nan(...args))

/**
 * Decorator to specify that the value should be a record https://zod.dev/?id=records
 * @param type - The type of keys in the record
 * @param type2 - The type of values in the record
 * @returns Zod Type decorator
 */
export const IsRecord = (
    type: TFunction | z.ZodType | TPrimitives,
    type2?: TFunction | z.ZodType | TPrimitives,
) => Zod(z.record(toZodType(type), type2 ? toZodType(type2) : undefined))

/**
 * Decorator to specify that the value should be a union of multiple types https://zod.dev/?id=unions
 * @param types - The types to include in the union
 * @returns Zod Type decorator
 */
export const IsUnion = (...types: [(TFunction | z.ZodType | TPrimitives), (TFunction | z.ZodType | TPrimitives), ...(TFunction | z.ZodType | TPrimitives)[]]) => Zod(
    z.union(types.map(t => toZodType(t)) as unknown as (readonly [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]))
)

/**
 * Decorator to specify that the value should be a discriminated union https://zod.dev/?id=discriminated-unions
 * @param discriminator - The property name to use as the discriminator
 * @param options - The options for the discriminated union
 * @returns Zod Type decorator
 */
export const IsDiscriminatedUnion = (discriminator: string, options: [(TFunction | z.ZodType | TPrimitives), (TFunction | z.ZodType | TPrimitives), ...(TFunction | z.ZodType | TPrimitives)[]]) => Zod(
    z.discriminatedUnion(
        discriminator,
        options.map(t => toZodType(t)) as unknown as [z.ZodDiscriminatedUnionOption<string>, z.ZodDiscriminatedUnionOption<string>, ...z.ZodDiscriminatedUnionOption<string>[]],
    )
)

/**
 * Decorator to specify that the value should be an intersection of multiple types https://zod.dev/?id=intersections
 * @param left - The left type for the intersection
 * @param right - The right type for the intersection
 * @returns Zod Type decorator
 */
export const IsIntersection = (left: (TFunction | z.ZodType | TPrimitives), right: (TFunction | z.ZodType | TPrimitives)) => Zod(
    z.intersection(toZodType(left), toZodType(right))
)

/**
 * Decorator to specify that the value should be a promise https://zod.dev/?id=promises
 * @param type - The type of the promise value.
 * @returns Zod Type decorator
 */
export const IsPromise = (type: TFunction | z.ZodType | TPrimitives) => Zod(z.promise(toZodType(type)))

/**
 * Decorator to specify that the value should be preprocessed with a function https://zod.dev/?id=preprocess
 * @param fn - The preprocessing function
 * @param type - The type of the preprocessed value
 * @returns Zod Preprocess Decorator
 */
export const Preprocess = <T>(fn: ((arg: unknown) => T)) => mate.decorate('zodPreprocess', fn, true)

/**
 * Preoprocess (cast to number) Zod value before check. Works stricter than coerce, only valid numbers pass.
 * @returns Zod Preprocess Decorator
 */
export const ToNumber = () => Preprocess((val: unknown) => typeof val === 'string' && !!val ? Number(val) : val)

/**
 * Preoprocess (cast to boolean) Zod value before check. Works stricter than coerce, can be adjusted.
 * @param truthful - list of truthful values, default: ['true', 'True', 'TRUE', 1]
 * @param falsy - list of falsy values, default: ['false', 'False', 'FALSE', 0]
 * @returns Zod Preprocess Decorator
 */
export const ToBoolean = (truthful: unknown[] = ['true', 'True', 'TRUE', 1], falsy: unknown[] = ['false', 'False', 'FALSE', 0]) => Preprocess((val: unknown) => {
    if (typeof val !== 'boolean') return val
    if (truthful.includes(val)) return true
    if (falsy.includes(val)) return false
    return val
})

/**
 * Decorator to specify that the value should be a custom type https://zod.dev/?id=custom-schemas
 * @param args - Arguments for the `custom` method of Zod 
 * @returns Zod Type decorator
 */
export const IsCustom = (...args: Parameters<typeof z.custom>) => Zod(z.custom(...args))

/**
 * Decorator for creating intersection type https://zod.dev/?id=and
 * @param type - The type to intersect
 * @returns Zod Type decorator
 */
export const And = (type: TFunction | z.ZodType | TPrimitives) => mate.decorate('zodFn', (t) => t.and(toZodType(type)), true)

/**
 * Decorator for creating union type https://zod.dev/?id=or
 * @param type - The type to union
 * @returns Zod Type decorator
 */
export const Or = (type: TFunction | z.ZodType | TPrimitives) => mate.decorate('zodFn', (t) => t.or(toZodType(type)), true)

function toZodType(type: TFunction | z.ZodType | TPrimitives, opts?: TZodOpts): z.ZodType {
    if (type instanceof z.ZodType) return type
    if (typeof type === 'string') return resolveZodPrimitive(type)
    return getZodType({ type }, opts)
}
