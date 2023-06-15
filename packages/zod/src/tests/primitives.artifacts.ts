// deno-lint-ignore-file
import { Coerce, IsUnknown, MatchesRegex, Max, Min, ToBoolean, ToNumber, Transform } from '../zod.decorators'

export class PrimitivesTestClass {
    propString: string = ''

    propNumber: number = 1

    propBigint: bigint = BigInt(2)

    propBoolean: boolean = true

    propDate: Date = new Date()

    propSymbol: symbol = Symbol('1')

    propUndefined: undefined = undefined

    propNull: null = null

    @IsUnknown()
    propUnknown!: unknown
}

export class PrimitivesTestClass2 {
    str = ''

    n = 5

    b = false

    d = new Date()

    nl = null
}

export class PrimitivesTestClass3 {
    @Min(2)
    @MatchesRegex(/^[A-Za-z]+$/, { message: 'Must contain of only alphabetical letters' })
    @Transform((s: string) => s[0].toUpperCase() + s.slice(1))
    str = ''

    @ToNumber()
    @Min(12)
    @Max(70)
    n = 5

    @ToBoolean()
    b = false

    @Coerce()
    @Transform((d: Date) => d.toISOString())
    d = new Date()

    nl = null
}
