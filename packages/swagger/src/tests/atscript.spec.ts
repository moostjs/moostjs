import { MoostHttp } from '@moostjs/event-http'
import { Moost } from 'moost'

import { mapToSwaggerSpec } from '../mapping'
import { AtscriptController, LegacyThrowingController } from './atscript.artifacts'
import { describe, it, expect, beforeAll, vi } from 'vitest'

describe('atscript annotated types', () => {
  const app = new Moost()
  app.adapter(new MoostHttp())
  app.registerControllers(AtscriptController)
  let spec: ReturnType<typeof mapToSwaggerSpec>
  let warnCalls: unknown[][]

  beforeAll(async () => {
    await app.init()
    const metadata = app.getControllersOverview()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      spec = mapToSwaggerSpec(metadata)
      // second run: the emit.jsonSchema hint must NOT be logged again
      mapToSwaggerSpec(metadata)
      warnCalls = warnSpy.mock.calls.map((call) => [...call])
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('must use toJsonSchema() of an annotated body type as a component schema', () => {
    const toTest = spec.paths['/atscript/body'].post
    expect(toTest.requestBody).toBeDefined()
    expect(toTest.requestBody?.required).toBe(true)
    expect(toTest.requestBody?.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/AtscriptDto',
    })
    expect(spec.components.schemas.AtscriptDto).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    })
  })

  it('must use toJsonSchema() of an annotated route param type', () => {
    const toTest = spec.paths['/atscript/param/{id}'].get
    expect(toTest.parameters).toHaveLength(1)
    expect(toTest.parameters[0]).toEqual({
      name: 'id',
      in: 'path',
      description: undefined,
      required: true,
      schema: { $ref: '#/components/schemas/AtscriptDto' },
    })
  })

  it('must explode annotated query object type into query parameters', () => {
    const toTest = spec.paths['/atscript/query'].get
    expect(toTest.parameters).toEqual([
      {
        name: 'name',
        in: 'query',
        description: undefined,
        required: true,
        schema: { type: 'string' },
      },
      {
        name: 'age',
        in: 'query',
        description: undefined,
        required: false,
        schema: { type: 'number' },
      },
    ])
  })

  it('must fall back to no request body when annotated toJsonSchema() throws', () => {
    // same output as a plain class without toJsonSchema (legacy fallback)
    expect(spec.paths['/atscript/throwing'].post.requestBody).toBeUndefined()
    expect(spec.paths['/atscript/throwing-2'].post.requestBody).toBeUndefined()
  })

  it('must fall back to string schema for a route param when toJsonSchema() throws', () => {
    const toTest = spec.paths['/atscript/throwing-param/{id}'].get
    expect(toTest.parameters[0]).toEqual({
      name: 'id',
      in: 'path',
      description: undefined,
      required: true,
      schema: { type: 'string' },
    })
  })

  it('must warn only once when annotated toJsonSchema() throws', () => {
    expect(warnCalls).toHaveLength(1)
    expect(String(warnCalls[0][0])).toContain('jsonSchema')
  })

  it('must hoist $defs of annotated schemas into components (hoistDefs)', () => {
    const toTest = spec.paths['/atscript/nested'].post
    expect(toTest.requestBody?.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/AtscriptNestedDto',
    })
    const nested = spec.components.schemas.AtscriptNestedDto
    expect(nested.$defs).toBeUndefined()
    expect(nested.properties!.address).toEqual({ $ref: '#/components/schemas/AtsAddress' })
    expect(spec.components.schemas.AtsAddress).toEqual({
      type: 'object',
      properties: {
        street: { type: 'string' },
      },
    })
  })

  it('must keep legacy behavior for a plain class body (no request body)', () => {
    expect(spec.paths['/atscript/plain'].post.requestBody).toBeUndefined()
  })

  it('must keep legacy string fallback for a plain class route param', () => {
    const toTest = spec.paths['/atscript/plain-param/{name}'].get
    expect(toTest.parameters[0]).toEqual({
      name: 'name',
      in: 'path',
      description: undefined,
      required: true,
      schema: { type: 'string' },
    })
  })
})

describe('non-annotated toJsonSchema() errors', () => {
  it('must propagate (behavior unchanged for non-annotated types)', async () => {
    const app = new Moost()
    app.adapter(new MoostHttp())
    app.registerControllers(LegacyThrowingController)
    await app.init()
    const metadata = app.getControllersOverview()
    expect(() => mapToSwaggerSpec(metadata)).toThrow('legacy toJsonSchema throw')
  })
})
