import { Circular } from '../circular.decorator'

export class CircularTestClassA {

}

export class CircularTestClassB {
    constructor(@Circular(() => CircularTestClassA) private a: CircularTestClassA) {
        if (!this.a) {
            console.log()
        }
    }
}
