# Validation API Reference

[[toc]]

## Class-Level Decorators

Class-level decorators apply validation rules to entire classes or objects, influencing how instances of these classes are validated.

---

### `@Validatable()`

**Description:**  
Enables the Zod validation pipeline for the decorated class. This decorator marks the class as validatable, allowing Moost to automatically generate and apply validation schemas based on the defined property decorators.

**Usage:**

```ts
import { Validatable, IsString, IsEmail } from 'moost';

@Validatable()
export class CreateUserDto {
  @IsString()
  username!: string;

  @IsEmail()
  email!: string;
}
```
---

### `@Strict()`

**Description:**  
Configures the Zod object to enforce strict property definitions, disallowing unknown properties.

**Usage:**

```ts
import { Validatable, Strict, IsString } from 'moost';

@Validatable()
@Strict()
export class CreateUserDto {
  @IsString()
  username!: string;
}
```
---

### `@Passthrough()`

**Description:**  
Allows unknown properties in the Zod object, enabling flexibility in the data structure.

**Usage:**

```ts
import { Validatable, Passthrough, IsString } from 'moost';

@Validatable()
@Passthrough()
export class CreateUserDto {
  @IsString()
  username!: string;
}
```

---

### `@Strip()`

**Description:**  
Removes unknown properties from the Zod object, ensuring that only defined properties are retained.

**Usage:**

```ts
import { Validatable, Strip, IsString } from 'moost';

@Validatable()
@Strip()
export class CreateUserDto {
  @IsString()
  username!: string;
}
```

## Property-Level Decorators

Property-level decorators define validation rules for individual class properties, specifying the expected data types and constraints.

---

### `@Zod(type: TZodMate['zodType'])`

**Description:**  
Specifies the Zod type for a property, allowing detailed validation rules to be applied.

**Parameters:**

- `type`: The Zod type to apply (e.g., `z.string()`, `z.number()`).

**Usage:**

```ts
import { Validatable, Zod } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreateUserDto {
  @Zod(z.string().min(3))
  username!: string;
}
```

#### Chained Methods

The `@Zod` decorator supports chained methods for additional validations:

- `.optional()`
- `.nullable()`
- `.nullish()`

**Usage:**

```ts
import { Validatable, Zod } from 'moost';
import { z } from 'zod';

@Validatable()
export class UpdateUserDto {
  @Zod(z.string())
    .optional()
  username?: string;
}
```

---

### `@ZodSkip()`

**Description:**  
Marks class or object validations to be skipped, effectively excluding the decorated target from the validation pipeline.

**Usage:**

```ts
import { Validatable, ZodSkip } from 'moost';

@Validatable()
@ZodSkip()
export class NoValidationDto {
  // This class will be skipped in the validation process
}
```

---

### `@LazyType(getter: () => z.ZodType)`

**Description:**  
Specifies a Zod type lazily, useful for handling recursive or circular dependencies in validation schemas.

**Parameters:**

- `getter`: A function that returns the Zod type.

**Usage:**

```ts
import { Validatable, LazyType } from 'moost';
import { z } from 'zod';

@Validatable()
export class Node {
  @LazyType(() => z.object({
    name: z.string(),
    children: z.array(z.lazy(() => NodeSchema)),
  }))
  children!: Node[];
}

const NodeSchema = z.object({
  name: z.string(),
  children: z.array(z.lazy(() => NodeSchema)),
});
```

---

### `@Coerce()`

**Description:**  
Enables coercion for the decorated property, allowing Zod to transform input data to the expected type.

**Usage:**

```ts
import { Validatable, Coerce, Zod } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreateUserDto {
  @Coerce()
  @Zod(z.number())
  age!: number;
}
```

---

### `@Default(value: unknown)`

**Description:**  
Defines a default value for the Zod type, which is used if the input data is `undefined`.

**Parameters:**

- `value`: The default value to assign.

**Usage:**

```ts
import { Validatable, Default, Zod } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreateUserDto {
  @Default('Guest')
  @Zod(z.string())
  role!: string;
}
```

---

### `@IsArray(types?: ...)`

**Description:**  
Specifies that the property should be an array or tuple, optionally defining the types of its items.

**Parameters:**

- `types`: A function or array of functions returning Zod types for the array items.
- `opts`: Optional coercion options.

**Usage:**

```ts
import { Validatable, IsArray, Zod } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreatePostDto {
  @IsArray(z.string())
  @Zod(z.string())
  tags!: string[];
}
```

#### Chained Methods

The `@IsArray` decorator supports chained methods similar to `@Zod`:

- `.optional()`
- `.nullable()`
- `.nullish()`

**Usage:**

```ts
import { Validatable, IsArray } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreatePostDto {
  @IsArray(z.string()).optional()
  tags?: string[];
}
```

---

### `@Refine(...)`

**Description:**  
Refines the Zod type with additional constraints using the `refine` method.

**Parameters:**

- `...args`: Arguments for the `refine` method of the Zod type.

**Usage:**

```ts
import { Validatable, Zod, Refine } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreateUserDto {
  @Zod(z.string())
  @Refine(value => value.length >= 3, { message: "Username must be at least 3 characters long" })
  username!: string;
}
```

---

### `@SuperRefine(...)`

**Description:**  
Super refines the Zod type with complex constraints using the `superRefine` method.

**Parameters:**

- `...args`: Arguments for the `superRefine` method of the Zod type.

**Usage:**

```ts
import { Validatable, Zod, SuperRefine } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreateUserDto {
  @Zod(z.string())
  password!: string;

  @Zod(z.string())
  confirmPassword!: string;

  @SuperRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
      });
    }
  })
  confirmPasswordCheck!: string;
}
```

---

### `@Trim()`

**Description:**  
Trims whitespace from the beginning and end of the string using the `trim` method.

**Usage:**

```ts
import { Validatable, Zod, Trim } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreateUserDto {
  @Trim()
  @Zod(z.string())
  username!: string;
}
```

---

### `@Transform(...)`

**Description:**  
Transforms the Zod type with a transformation function using the `transform` method.

**Parameters:**

- `...args`: Arguments for the `transform` method of the Zod type.

**Usage:**

```ts
import { Validatable, Zod, Transform } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreateUserDto {
  @Transform((val: string) => val.toUpperCase())
  @Zod(z.string())
  username!: string;
}
```

---

### `@OnCatch(def: ...)`

**Description:**  
Handles errors during parsing or validating the Zod type using the `catch` method.

**Parameters:**

- `def`: A default value or error handler function.

**Usage:**

```ts
import { Validatable, Zod, OnCatch } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreateUserDto {
  @OnCatch("Unknown")
  @Zod(z.string())
  role!: string;
}
```

---

### `@HasLength(...)`

**Description:**  
Specifies that the Zod string type should have a specific length using the `length` method.

**Parameters:**

- `...args`: Arguments for the `length` method of the Zod string type.

**Usage:**

```ts
import { Validatable, Zod, HasLength } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreateUserDto {
  @HasLength(5)
  @Zod(z.string())
  code!: string;
}
```

---

### `@Min(...)`

**Description:**  
Specifies the minimum value for the Zod number type using the `min` method.

**Parameters:**

- `...args`: Arguments for the `min` method of the Zod number type.

**Usage:**

```ts
import { Validatable, Zod, Min } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreateProductDto {
  @Min(0)
  @Zod(z.number())
  price!: number;
}
```

---

### `@Max(...)`

**Description:**  
Specifies the maximum value for the Zod number type using the `max` method.

**Parameters:**

- `...args`: Arguments for the `max` method of the Zod number type.

**Usage:**

```ts
import { Validatable, Zod, Max } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreateProductDto {
  @Max(1000)
  @Zod(z.number())
  price!: number;
}
```

---

### `@DateFrom(...)`

**Description:**  
Specifies the minimum date for the Zod date type using the `min` method.

**Parameters:**

- `...args`: Arguments for the `min` method of the Zod date type.

**Usage:**

```ts
import { Validatable, Zod, DateFrom } from 'moost';
import { z } from 'zod';

@Validatable()
export class EventDto {
  @DateFrom(new Date())
  @Zod(z.date())
  startDate!: Date;
}
```

---

### `@DateTo(...)`

**Description:**  
Specifies the maximum date for the Zod date type using the `max` method.

**Parameters:**

- `...args`: Arguments for the `max` method of the Zod date type.

**Usage:**

```ts
import { Validatable, Zod, DateTo } from 'moost';
import { z } from 'zod';

@Validatable()
export class EventDto {
  @DateTo(new Date('2030-01-01'))
  @Zod(z.date())
  endDate!: Date;
}
```

---

### `@IsNullable()`

**Description:**  
Allows the Zod type to accept `null` values using the `nullable` method.

**Usage:**

```ts
import { Validatable, Zod, IsNullable } from 'moost';
import { z } from 'zod';

@Validatable()
export class UpdateUserDto {
  @IsNullable()
  @Zod(z.string())
  nickname?: string | null;
}
```

---

### `@IsNullish()`

**Description:**  
Allows the Zod type to accept `null` or `undefined` values using the `nullish` method.

**Usage:**

```ts
import { Validatable, Zod, IsNullish } from 'moost';
import { z } from 'zod';

@Validatable()
export class UpdateUserDto {
  @IsNullish()
  @Zod(z.string())
  nickname?: string | null | undefined;
}
```

## Advanced Decorators

Advanced decorators provide additional validation capabilities, allowing for more complex and nuanced validation scenarios.

---

### `@Preprocess(fn: (arg: unknown) => T)`

**Description:**  
Preprocesses (transforms) the input value before validation using the `preprocess` method.

**Parameters:**

- `fn`: A function that transforms the input value.

**Usage:**

```ts
import { Validatable, Preprocess, Zod } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreateUserDto {
  @Preprocess((val: unknown) => (typeof val === 'string' ? val.trim() : val))
  @Zod(z.string())
  username!: string;
}
```

---

### `@ToNumber()`

**Description:**  
Casts the input value to a number before validation. It operates stricter than `@Coerce`, allowing only valid numbers to pass.

**Usage:**

```ts
import { Validatable, ToNumber, Zod } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreateOrderDto {
  @ToNumber()
  @Zod(z.number())
  quantity!: number;
}
```

---

### `@ToBoolean(truthful?: unknown[], falsy?: unknown[])`

**Description:**  
Casts the input value to a boolean before validation. It can be customized with lists of truthful and falsy values.

**Parameters:**

- `truthful`: List of values to be considered as `true`. Default: `['true', 'True', 'TRUE', 1]`
- `falsy`: List of values to be considered as `false`. Default: `['false', 'False', 'FALSE', 0]`

**Usage:**

```ts
import { Validatable, ToBoolean, Zod } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreateSettingsDto {
  @ToBoolean(['yes', 'Yes'], ['no', 'No'])
  @Zod(z.boolean())
  notificationsEnabled!: boolean;
}
```

---

### `@IsCustom(...)`

**Description:**  
Applies a custom Zod schema using the `custom` method, allowing for bespoke validation logic.

**Parameters:**

- `...args`: Arguments for the `custom` method of Zod.

**Usage:**

```ts
import { Validatable, IsCustom, Zod } from 'moost';
import { z } from 'zod';

const positiveNumber = z.number().refine(val => val > 0, {
  message: "Number must be positive",
});

@Validatable()
export class CreateItemDto {
  @IsCustom(z.number().refine(val => val > 0, { message: "Must be positive" }))
  @Zod(z.number())
  quantity!: number;
}
```

---

### `@And(type: ...)`

**Description:**  
Creates an intersection type using the `and` method, combining multiple Zod schemas.

**Parameters:**

- `type`: The Zod type to intersect with the current type.

**Usage:**

```ts
import { Validatable, And, Zod } from 'moost';
import { z } from 'zod';

const baseSchema = z.object({
  name: z.string(),
});

const extendedSchema = baseSchema.and(z.object({
  age: z.number().min(18),
}));

@Validatable()
export class CreatePersonDto {
  @And(z.object({ age: z.number().min(18) }))
  @Zod(z.object({
    name: z.string(),
    age: z.number(),
  }))
  person!: { name: string; age: number };
}
```

---

### `@Or(type: ...)`

**Description:**  
Creates a union type using the `or` method, allowing the value to conform to any of the specified Zod schemas.

**Parameters:**

- `type`: The Zod type to include in the union.

**Usage:**

```ts
import { Validatable, Or, Zod } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreateResponseDto {
  @Or(z.string(), z.number())
  @Zod(z.union([z.string(), z.number()]))
  result!: string | number;
}
```

---

### `@IsUnion(...types: ...)`

**Description:**  
Specifies that the value should be a union of multiple types using the `z.union` method.

**Parameters:**

- `...types`: Array of Zod types to include in the union.

**Usage:**

```ts
import { Validatable, IsUnion, Zod } from 'moost';
import { z } from 'zod';

@Validatable()
export class CreateResponseDto {
  @IsUnion(z.string(), z.number())
  @Zod(z.union([z.string(), z.number()]))
  result!: string | number;
}
```

---

### `@IsDiscriminatedUnion(discriminator: string, options: ...)`

**Description:**  
Creates a discriminated union type using the `z.discriminatedUnion` method.

**Parameters:**

- `discriminator`: The property name used as the discriminator.
- `options`: Array of Zod object schemas to include in the union.

**Usage:**

```ts
import { Validatable, IsDiscriminatedUnion, Zod } from 'moost';
import { z } from 'zod';

@Validatable()
export class ShapeDto {
  @IsDiscriminatedUnion('type', [
    z.object({ type: z.literal('circle'), radius: z.number().min(0) }),
    z.object({ type: z.literal('square'), side: z.number().min(0) }),
  ])
  @Zod(z.discriminatedUnion('type', [
    z.object({ type: z.literal('circle'), radius: z.number() }),
    z.object({ type: z.literal('square'), side: z.number() }),
  ]))
  shape!: { type: 'circle'; radius: number } | { type: 'square'; side: number };
}
```

---

### `@IsIntersection(left: ..., right: ...)`

**Description:**  
Creates an intersection type using the `z.intersection` method, combining two Zod schemas.

**Parameters:**

- `left`: The left Zod type for the intersection.
- `right`: The right Zod type for the intersection.

**Usage:**

```ts
import { Validatable, IsIntersection, Zod } from 'moost';
import { z } from 'zod';

const baseSchema = z.object({
  name: z.string(),
});

const ageSchema = z.object({
  age: z.number().min(18),
});

@Validatable()
export class CreateUserDto {
  @IsIntersection(baseSchema, ageSchema)
  @Zod(z.intersection(baseSchema, ageSchema))
  user!: { name: string; age: number };
}
```

## Summary of Validation Decorators

| **Decorator**          | **Type**        | **Description**                                                                                                                                                      |
|------------------------|-----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `@Validatable()`      | Class           | Enables the Zod validation pipeline for the decorated class.                                                                                                         |
| `@Strict()`           | Class           | Enforces strict property definitions, disallowing unknown properties.                                                                                               |
| `@Passthrough()`      | Class           | Allows unknown properties in the Zod object, enabling flexibility.                                                                                                  |
| `@Strip()`            | Class           | Removes unknown properties from the Zod object, ensuring only defined properties are retained.                                                                       |
| `@Zod(type)`          | Property        | Specifies the Zod type for a property, allowing detailed validation rules.                                                                                            |
| `@ZodSkip()`          | Class/Object    | Marks validations to be skipped for the decorated class or object.                                                                                                  |
| `@LazyType(getter)`   | Property        | Specifies a Zod type lazily, useful for handling recursive or circular dependencies.                                                                                 |
| `@Coerce()`           | Property        | Enables coercion for the decorated property, allowing Zod to transform input data to the expected type.                                                              |
| `@Default(value)`     | Property        | Defines a default value for the Zod type, used if the input data is `undefined`.                                                                                     |
| `@IsArray(types, opts)`| Property        | Specifies that the property should be an array or tuple, optionally defining the types of its items.                                                                    |
| `@Refine(...args)`    | Parameter/Misc   | Refines the Zod type with additional constraints using the `refine` method.                                                                                          |
| `@SuperRefine(...args)`| Parameter/Misc   | Super refines the Zod type with complex constraints using the `superRefine` method.                                                                                    |
| `@Trim()`             | Parameter        | Trims whitespace from the beginning and end of the string using the `trim` method.                                                                                    |
| `@Transform(...args)` | Parameter        | Transforms the Zod type with a transformation function using the `transform` method.                                                                                  |
| `@OnCatch(def)`       | Parameter        | Handles errors during parsing or validating the Zod type using the `catch` method.                                                                                    |
| `@HasLength(...args)` | Parameter        | Specifies that the Zod string type should have a specific length using the `length` method.                                                                            |
| `@Min(...args)`       | Parameter        | Specifies the minimum value for the Zod number type using the `min` method.                                                                                           |
| `@Max(...args)`       | Parameter        | Specifies the maximum value for the Zod number type using the `max` method.                                                                                           |
| `@DateFrom(...args)`  | Parameter        | Specifies the minimum date for the Zod date type using the `min` method.                                                                                              |
| `@DateTo(...args)`    | Parameter        | Specifies the maximum date for the Zod date type using the `max` method.                                                                                              |
| `@IsNullable()`       | Parameter        | Allows the Zod type to accept `null` values using the `nullable` method.                                                                                            |
| `@IsNullish()`        | Parameter        | Allows the Zod type to accept `null` or `undefined` values using the `nullish` method.                                                                                |
| `@IsEmail(...args)`   | Parameter/String | Validates that the string is a valid email address using the `email` method.                                                                                        |
| `@IsUrl(...args)`     | Parameter/String | Validates that the string is a valid URL using the `url` method.                                                                                                    |
| `@IsEmoji(...args)`   | Parameter/String | Validates that the string contains valid emojis using the `emoji` method.                                                                                           |
| `@IsUuid(...args)`    | Parameter/String | Validates that the string is a valid UUID using the `uuid` method.                                                                                                 |
| `@IsCuid(...args)`    | Parameter/String | Validates that the string is a valid CUID using the `cuid` method.                                                                                                 |
| `@IsCuid2(...args)`   | Parameter/String | Validates that the string is a valid CUID version 2 using the `cuid2` method.                                                                                      |
| `@IsUlid(...args)`    | Parameter/String | Validates that the string is a valid ULID using the `ulid` method.                                                                                                 |
| `@IsDatetime(...args)`| Parameter/String | Validates that the string is a valid datetime using the `datetime` method.                                                                                         |
| `@IsIp(...args)`      | Parameter/String | Validates that the string is a valid IP address using the `ip` method.                                                                                             |
| `@MatchesRegex(...args)`| Parameter/String | Validates that the string matches a specific regular expression using the `regex` method.                                                                             |
| `@StartsWith(...args)`| Parameter/String | Validates that the string starts with a specific substring using the `startsWith` method.                                                                            |
| `@EndsWith(...args)`  | Parameter/String | Validates that the string ends with a specific substring using the `endsWith` method.                                                                              |
| `@IsGt(...args)`      | Parameter/Number | Specifies that the number should be greater than a specific value using the `gt` method.                                                                            |
| `@IsGte(...args)`     | Parameter/Number | Specifies that the number should be greater than or equal to a specific value using the `gte` method.                                                                |
| `@IsLt(...args)`      | Parameter/Number | Specifies that the number should be less than a specific value using the `lt` method.                                                                             |
| `@IsLte(...args)`     | Parameter/Number | Specifies that the number should be less than or equal to a specific value using the `lte` method.                                                                 |
| `@IsInt(...args)`     | Parameter/Number | Specifies that the number should be an integer using the `int` method.                                                                                           |
| `@IsPositive(...args)`| Parameter/Number | Specifies that the number should be positive using the `positive` method.                                                                                         |
| `@IsNonnegative(...args)`| Parameter/Number | Specifies that the number should be non-negative using the `nonnegative` method.                                                                                 |
| `@IsNegative(...args)`| Parameter/Number | Specifies that the number should be negative using the `negative` method.                                                                                         |
| `@IsNonpositive(...args)`| Parameter/Number | Specifies that the number should be non-positive using the `nonpositive` method.                                                                                 |
| `@IsMultipleOf(...args)`| Parameter/Number | Specifies that the number should be a multiple of a specific value using the `multipleOf` method.                                                                    |
| `@IsFinite(...args)`  | Parameter/Number | Specifies that the number should be finite using the `finite` method.                                                                                            |
| `@IsSafeNumber(...args)`| Parameter/Number | Specifies that the number should be a safe number using the `safe` method.                                                                                       |
| `@Includes(...args)`  | Parameter/String | Specifies that the string should include a specific substring using the `includes` method.                                                                          |
| `@IsString(...args)`  | Property/Primitive | Specifies that the value should be a string using the `string` method.                                                                                             |
| `@IsNumber(...args)`  | Property/Primitive | Specifies that the value should be a number using the `number` method.                                                                                             |
| `@IsBigint(...args)`  | Property/Primitive | Specifies that the value should be a bigint using the `bigint` method.                                                                                           |
| `@IsBoolean(...args)` | Property/Primitive | Specifies that the value should be a boolean using the `boolean` method.                                                                                         |
| `@IsDate(...args)`    | Property/Primitive | Specifies that the value should be a date using the `date` method.                                                                                               |
| `@IsSymbol(...args)`  | Property/Primitive | Specifies that the value should be a symbol using the `symbol` method.                                                                                           |
| `@IsUndefined(...args)`| Property/Primitive | Specifies that the value should be undefined using the `undefined` method.                                                                                       |
| `@IsNull(...args)`    | Property/Primitive | Specifies that the value should be null using the `null` method.                                                                                                 |
| `@IsVoid(...args)`    | Property/Primitive | Specifies that the value should be void using the `void` method.                                                                                                 |
| `@IsAny(...args)`     | Property/Primitive | Specifies that the value can be of any type using the `any` method.                                                                                            |
| `@IsUnknown(...args)` | Property/Primitive | Specifies that the value is of an unknown type using the `unknown` method.                                                                                      |
| `@IsNever(...args)`   | Property/Primitive | Specifies that the value should never occur using the `never` method.                                                                                           |
| `@IsTuple(schemas)`   | Property/Advanced   | Specifies that the value should be a tuple using the `tuple` method.                                                                                            |
| `@IsEnum(...args)`    | Property/Advanced   | Specifies that the value should be an enum type using the `enum` method.                                                                                        |
| `@IsNativeEnum(...args)`| Property/Advanced   | Specifies that the value should be a native enum type using the `nativeEnum` method.                                                                              |
| `@IsSet(type)`        | Property/Advanced   | Specifies that the value should be a set of a specific type using the `set` method.                                                                                |
| `@IsMap(type, type2)` | Property/Advanced   | Specifies that the value should be a map with specific key and value types using the `map` method.                                                                  |
| `@IsLiteral(...args)` | Property/Advanced   | Specifies that the value should be a literal using the `literal` method.                                                                                         |
| `@IsNaN(...args)`     | Property/Advanced   | Specifies that the value should be NaN using the `nan` method.                                                                                                  |
| `@IsRecord(type, type2)`| Property/Advanced | Specifies that the value should be a record with specific key and value types using the `record` method.                                                            |
| `@IsUnion(...types)`  | Property/Advanced   | Specifies that the value should be a union of multiple types using the `union` method.                                                                             |
| `@IsDiscriminatedUnion(discriminator, options)`| Property/Advanced | Specifies that the value should be a discriminated union using the `discriminatedUnion` method.                                                                     |
| `@IsIntersection(left, right)`| Property/Advanced | Specifies that the value should be an intersection of multiple types using the `intersection` method.                                                               |
| `@IsPromise(type)`    | Property/Advanced   | Specifies that the value should be a promise of a specific type using the `promise` method.                                                                        |
| `@Preprocess(fn)`     | Property/Advanced   | Preprocesses the input value before validation using the `preprocess` method.                                                                                    |
| `@ToNumber()`         | Property/Advanced   | Casts the input value to a number before validation, ensuring only valid numbers pass.                                                                             |
| `@ToBoolean(truthful, falsy)`| Property/Advanced | Casts the input value to a boolean before validation, based on specified truthful and falsy values.                                                                  |
| `@IsCustom(...args)`  | Property/Advanced   | Applies a custom Zod schema using the `custom` method for bespoke validation logic.                                                                                 |
| `@And(type)`          | Property/Advanced   | Creates an intersection type with another Zod type using the `and` method.                                                                                        |
| `@Or(type)`           | Property/Advanced   | Creates a union type with another Zod type using the `or` method.                                                                                                 |
| `@And(type)`          | Property/Advanced   | Creates an intersection type with another Zod type using the `and` method.                                                                                        |

## Utility Functions

In addition to decorators, Moost provides utility functions to perform validations programmatically.

## `validate(data, dto, opts?, safe?, logger?)`

**Description:**  
Validates the input data against a Zod type or a class with Zod metadata.

**Parameters:**

- `data`: The data to validate.
- `dto`: The Zod type or class with Zod metadata.
- `opts` _(optional)_: Options for Zod validation.
- `safe` _(optional)_: If `true`, uses `safeParseAsync` for safe parsing.
- `logger` _(optional)_: Custom logger for logging validation errors.

**Returns:**  
A promise that resolves to the validated data or a safe parse result based on the `safe` parameter.

**Usage:**

```ts
import { validate } from 'moost';
import { CreateUserDto } from './dto/create-user.dto';

const userData = {
  username: 'john_doe',
  email: 'john@example.com',
};

validate(userData, CreateUserDto)
  .then(validatedData => {
    console.log('Validated Data:', validatedData);
  })
  .catch(error => {
    console.error('Validation Error:', error);
  });
```

## `getZodTypeForProp(origin, target, opts?, logger?)`

**Description:**  
Retrieves the Zod type for a class property or method parameter based on metadata.

**Parameters:**

- `origin`: An object containing the class type, property key, and optionally, parameter index.
- `target`: An object containing the target type, value, and additional metadata.
- `opts` _(optional)_: Zod options.
- `logger` _(optional)_: Custom logger.

**Returns:**  
A `ZodType` instance representing the validation schema for the property or parameter.

**Usage:**

```ts
import { getZodTypeForProp } from 'moost';
import { CreateUserDto } from './dto/create-user.dto';

const zodType = getZodTypeForProp(
  { type: CreateUserDto, key: 'username' },
  { type: String },
);
```

## `getZodType(target, opts?, logger?)`

**Description:**  
Generates a Zod type based on the target type and metadata.

**Parameters:**

- `target`: An object containing the target type, value, and additional metadata.
- `opts` _(optional)_: Zod options.
- `logger` _(optional)_: Custom logger.

**Returns:**  
A `ZodType` instance representing the validation schema.

**Usage:**

```ts
import { getZodType } from 'moost';
import { CreateUserDto } from './dto/create-user.dto';

const zodType = getZodType({ type: CreateUserDto });
```
