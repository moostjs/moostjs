# Pipelines 

Moost pipelines provide a powerful mechanism for applying resolvers and transformers
to method arguments when the framework needs to invoke a method, such as an event handler or a class constructor.

## Resolve Pipeline

One example of a Moost pipeline is the "Resolve Pipeline", which is automatically applied to all Moost applications by default.
The Resolve Pipeline is responsible for calling the resolve functions associated with each method argument.

To utilize the Resolve Pipeline, you can use the `@Resolve` decorator.
This decorator simply pushes the resolve callback to the parameter metadata.
Subsequently, the pipeline extracts the resolve callback and triggers it to resolve the argument value.

The Resolve Pipeline enables seamless dependency resolution by automatically resolving the necessary values for method arguments based on their corresponding resolve functions.

## Validation Pipeline

Another common use case for pipelines is the validation pipeline.
The documentation for this pipeline will be provided later, covering its specific functionality and usage.
