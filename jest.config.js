/* eslint-disable unicorn/no-abusive-eslint-disable */
/* eslint-disable */
import { dye } from '@prostojs/dye'
import path from 'path'
import { fileURLToPath } from 'url'

export const __filename = fileURLToPath(import.meta.url)
export const __dirname = path.dirname(__filename)

export default {
  preset: 'ts-jest',
  moduleFileExtensions: ['ts', 'js'],
  rootDir: __dirname,
  testRegex: '.spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['html', 'lcov', 'text'],
  collectCoverageFrom: ['packages/**/src/**/*.ts'],
  watchPathIgnorePatterns: ['/node_modules/', '/dist/', '/.git/'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@moostjs/(.*?)$': '<rootDir>/packages/$1/src',
    '^moost$': '<rootDir>/packages/moost/src',
    '^common$': '<rootDir>/common',
  },
  globals: {
    __DYE_WHITE__: dye('white').open,
    __DYE_UNDERSCORE_OFF__: '',
    __DYE_RED_BRIGHT__: dye('red-bright').open,
    __DYE_BOLD__: dye('bold').open,
    __DYE_UNDERSCORE__: dye('underscore').open,
    __DYE_UNDERSCORE_OFF__: dye('underscore').close,
    __DYE_BOLD_OFF__: dye.bold_off,
    __DYE_RESET__: dye.reset,
    __DYE_RED__: dye('red').open,
    __DYE_CYAN__: dye('cyan').open,
    __DYE_COLOR_OFF__: dye('red').close,
    __DYE_GREEN__: dye('green').open,
    __DYE_GREEN_BRIGHT__: dye('green-bright').open,
    __DYE_BLUE__: dye('blue').open,
    __DYE_YELLOW__: dye('yellow').open,
    __DYE_MAGENTA__: dye('magenta').open,
    __DYE_DIM__: dye('dim').open,
    __DYE_DIM_OFF__: dye('dim').close,
    __DYE_CROSSED__: dye('crossed').open,
    __DYE_CROSSED_OFF__: dye('crossed').close,
    __VERSION__: 'JEST_TEST',
    __PROJECT__: 'jest-test',
  },
}
