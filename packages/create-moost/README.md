# create-moost

<p align="center">
<img src="../../moost-logo.png" width="450px"><br>
<a  href="https://github.com/moostjs/moostjs/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</a>
</p>

`create-moost` is an npm initializer module that allows you to quickly set up new Moost applications. It provides a simple command-line interface to create Moost applications, either as a HTTP app or a CLI app.

## Getting Started

To use `create-moost`, make sure you have Node.js (version 14 or above) and npm (Node Package Manager) installed on your machine. Then, follow the steps below to create your Moost application.

### Creating a HTTP App

To create a Moost HTTP app, use the following command in your terminal:

```bash
npm create moost -- --http
```

This command will initiate the creation of a new Moost HTTP app. It will prompt you with a series of questions to configure your app, such as enabling eslint and prettier, and choosing between the esbuild and rollup bundlers.

### Creating a CLI App

To create a Moost CLI app, use the following command in your terminal:

```bash
npm create moost -- --cli
```

This command will start the creation process for a new Moost CLI app. It will ask you questions to customize your app, including eslint and prettier preferences, as well as the choice between the esbuild and rollup bundlers.

## [Official Documentation](https://moost.org/)
