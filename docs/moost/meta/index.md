# Metadata in Moost

Moost uses metadata to make setting up and managing different parts of your app easier. Metadata gives Moost useful details about classes, methods, and properties during the app's setup phase.

## Introduction to Metadata

Moost manages metadata using the [@prostojs/mate](https://github.com/prostojs/mate) npm module. This module makes it simple to save and find metadata for classes, methods, method arguments, and properties. By using Moost's decorators, you can add useful details to the metadata. This helps Moost find controllers, set up the provide registry, interceptors, resolvers, and more.

## Metadata Structure

Moost's metadata is organized like this:

-   Class Metadata: Data related to a class.
-   Method Metadata: Data related to a method in a class.
-   Method Props Metadata: Data related to method arguments in a class.
-   Property Metadata: Data related to a property in a class.

By filling in these metadata fields, Moost gets a better understanding of your app's structure and dependencies.

## Benefits of Metadata

Metadata in Moost offers several advantages:

-   Automatic Discovery: Moost can automatically find controllers, event handlers, and other parts by looking at the metadata.
-   Dependency Resolution: Metadata helps Moost figure out the connections between classes and make sure instances are created properly.
-   Customization and Extension: You can add to Moost by creating your own decorators and adding custom details to the metadata. This can give your app more features.

By using metadata, Moost makes setting up and managing parts of your app simpler, so you can concentrate on building strong and scalable systems.
