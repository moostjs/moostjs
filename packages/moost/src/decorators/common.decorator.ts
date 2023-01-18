import { getMoostMate } from '../metadata'

export function Label(value: string) {
    return getMoostMate().decorate('label', value)
}

export function Id(value: string) {
    return getMoostMate().decorate('id', value)
}

export function Optional() {
    return getMoostMate().decorate('optional', true)
}

export function Required() {
    const mate = getMoostMate()
    return mate.apply(
        mate.decorate('required', true),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        mate.decorateClass((meta, level, key, index) => {
            if (typeof index !== 'number' && meta && ['string', 'symbol'].includes(typeof key)) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                meta.requiredProps = meta.requiredProps || []
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                meta.requiredProps.push(key as string)
            }
            return meta
        }),
    ) 
}
