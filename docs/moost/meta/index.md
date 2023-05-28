# Metadata in Moost

Moost leverages the use of metadata to facilitate the initialization and management
of various components within your application.
Metadata provides valuable information about classes, methods, and properties,
which is used by Moost during the app initialization process.

## Introduction to Metadata
To handle metadata in Moost, we utilize the [@prostojs/mate](https://github.com/prostojs/mate) npm module.
This module provides a robust and efficient way to store and access metadata for classes, methods, methods arguments and properties.
By using decorators provided by Moost, you can populate the metadata fields with relevant values,
enabling Moost to perform tasks such as finding controllers, setting up the provide registry, interceptors, resolvers, and more.

## Metadata Structure
The metadata in Moost is organized based on the following structure:

-   Class Metadata: Metadata associated with a class.
-   Method Metadata: Metadata associated with a method within a class.
-   Method Props Metadata: Metadata associated with a method arguments within a class.
-   Property Metadata: Metadata associated with a property within a class.

By populating these metadata fields, Moost gains valuable insights into the structure and dependencies of your application.

## Benefits of Metadata
The use of metadata in Moost offers several benefits:

-   Automatic Discovery: Moost can automatically discover controllers, event handlers, and other components by inspecting the metadata.
-   Dependency Resolution: Metadata helps Moost resolve dependencies between classes and ensure proper instantiation of instances.
-   Customization and Extension: You can extend Moost by creating your own decorators and populating metadata with custom information to enhance the functionality of your application.

By leveraging metadata, Moost simplifies the initialization and management of components in your application, enabling you to focus on building robust and scalable systems.
