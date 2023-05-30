# Pipelines

Moost pipelines are a strong tool for using resolvers and transformers on method arguments, such as for an event handler or a class constructor.

## Resolve Pipeline

The Resolve Pipeline, which comes by default with all Moost applications, is a prime example. Its main role is to trigger the resolve functions tied to each method argument.

To use the Resolve Pipeline, apply the `@Resolve` decorator. This decorator adds the resolve callback to the parameter metadata. The pipeline then retrieves the callback and activates it to resolve the argument value.

This process allows the Resolve Pipeline to smoothly handle dependency resolution, automatically identifying required values for method arguments via their linked resolve functions.

## Validation Pipeline

Pipelines can also handle validation. Details about the validation pipeline, its unique features and how to use it, will be given later.
