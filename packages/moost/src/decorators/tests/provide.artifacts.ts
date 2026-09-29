import { Injectable } from '../injectable.decorator'
import { Inject, Provide } from '../provide.decorator'

export class ToInjectTestClass {
  constructor(public type: string) {}
}

@Provide(ToInjectTestClass, () => new ToInjectTestClass('via class'))
@Provide('to-inject', () => new ToInjectTestClass('via string'))
export class ProvideTestClass {
  constructor(@Inject(ToInjectTestClass) public a: ToInjectTestClass) {}
}

export class EmailService {
  constructor(public transport: string) {}
}

@Injectable()
@Provide(EmailService, () => new EmailService('smtp'))
export class NotificationService {
  constructor(@Inject(EmailService) public email: EmailService) {}
}

/** Two class tokens with identical source text (`class {}`) — distinct DI keys. */
export const PrimaryDbToken = class {}
export const ReplicaDbToken = class {}

@Injectable()
@Provide(PrimaryDbToken, () => 'primary')
@Provide(ReplicaDbToken, () => 'replica')
export class TwinTokenConsumer {
  constructor(
    @Inject(PrimaryDbToken) public primary: string,
    @Inject(ReplicaDbToken) public replica: string,
  ) {}
}
