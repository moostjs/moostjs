# Handling Retriable Errors

A workflow step can signal a recoverable failure by throwing a `StepRetriableError`. Unlike a regular error, this does not finish the workflow. Instead, it interrupts execution, returning a state that can be retried later, potentially with corrected input or after resolving external issues.

## Key Points

- **RetriableError Signals a Pause:**  
  Throwing `new StepRetriableError(originalError)` halts the workflow without marking it as finished, allowing you to resume it later.
- **Optional Input Requirements and Error Lists:**  
  You can pass `inputRequired` and an `errorList` to the retriable error. This can guide the user or system to supply corrected input or fix validation issues before retrying.
- **Flexible Usage:**  
  Use retriable errors to handle scenarios like invalid input, external system unavailability, or any condition where the workflow should be temporarily paused rather than permanently fail.

## Example

```ts
import { Step, StepRetriableError } from '@moostjs/event-wf';
import { Controller } from 'moost';

@Controller('process')
export class ProcessController {

  @Step('doStep')
  doStep(@WorkflowParam('input') input: any) {
    if (!this.isValid(input)) {
      throw new StepRetriableError(
        new Error('Validation failed'),
        [{ field: 'x', message: 'Invalid value' }], // error details
        { fields: ['x'] } // input required: fields to correct
      );
    }
    // Proceed if valid
  }

  isValid(input: any): boolean {
    return input && input.x === 'ok';
  }
}
```

**Result if invalid input:**

```json
{
  "finished": false,
  "interrupt": true,
  "error": "Error: Validation failed",
  "errorList": [{ "field": "x", "message": "Invalid value" }],
  "inputRequired": { "fields": ["x"] },
  "resume": [Function]
}
```

**Resuming:**
```ts
const output = await wf.start('process/doStep', {});
if (output.interrupt && output.resume) {
  const newResult = await output.resume({ x: 'ok' });
}
```

## Summary

`StepRetriableError` enables workflows to pause instead of fail, helping you handle transient issues gracefully. By including `errorList` and `inputRequired`, you can guide the user or system to fix problems and retry, keeping the workflow flexible and resilient.