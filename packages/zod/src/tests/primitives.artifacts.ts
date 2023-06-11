import { IsUnknown } from '../zod.decorators'

// deno-lint-ignore-file
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
