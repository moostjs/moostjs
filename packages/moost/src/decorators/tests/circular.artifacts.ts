import { Circular } from '../circular.decorator'

export class CircularTestClassA {}

export class CircularTestClassB {
  constructor(@Circular(() => CircularTestClassA) private readonly a: CircularTestClassA) {
    if (!this.a) {
      console.log()
    }
  }
}
