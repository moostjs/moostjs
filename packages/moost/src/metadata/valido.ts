import { getConstructor } from '@prostojs/mate'
import { TValidoDtoMeta, TValidoParamMeta, Valido } from '@prostojs/valido'
import { TFunction, TObject } from '../types'
import { getMoostMate } from './moost-metadata'

const valido = new Valido({
    getDtoMeta(value, _type?) {
        let type = _type as TObject | TFunction
        if (!type) {
            type = getConstructor(value)
        }
        const mate = getMoostMate()
        return mate.read(type) as unknown as TValidoDtoMeta
    },
    getDtoParamMeta(value, type, key) {
        const mate = getMoostMate()
        return mate.read(type as TFunction, key) as unknown as TValidoParamMeta
    },
})

export function getMoostValido() {
    return valido
}
