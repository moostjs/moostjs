export const atscriptGrammar = {
  name: 'atscript',
  aliases: ['as'],
  scopeName: 'source.atscript',
  fileTypes: ['as'],
  patterns: [
    {
      include: '#comments',
    },
    {
      include: '#annotations',
    },
    {
      include: '#interface',
    },
    {
      include: '#type-alias',
    },
    {
      include: '#imports',
    },
    {
      include: 'source.ts',
    },
  ],
  repository: {
    'comments': {
      patterns: [
        {
          name: 'comment.line.double-slash.atscript',
          match: '//.*$',
        },
        {
          name: 'comment.block.atscript',
          begin: '/\\*',
          end: '\\*/',
        },
      ],
    },
    'annotations': {
      patterns: [
        {
          name: 'meta.annotation.atscript',
          begin: '(@)([a-zA-Z_$][\\w$]*(?:\\.[a-zA-Z_$][\\w$]*)*)',
          beginCaptures: {
            1: { name: 'punctuation.decorator.atscript' },
            2: { name: 'entity.name.decorator.atscript' },
          },
          end: '(?=\\s|@|interface|type|export|import|{|}|;|$)',
          patterns: [
            {
              include: '#annotation-arguments',
            },
          ],
        },
      ],
    },
    'annotation-arguments': {
      patterns: [
        {
          name: 'meta.annotation.arguments.atscript',
          begin: '\\(',
          beginCaptures: {
            0: { name: 'punctuation.definition.arguments.begin.atscript' },
          },
          end: '\\)',
          endCaptures: {
            0: { name: 'punctuation.definition.arguments.end.atscript' },
          },
          patterns: [
            {
              include: '#annotation-argument-value',
            },
          ],
        },
      ],
    },
    'annotation-argument-value': {
      patterns: [
        {
          name: 'string.quoted.double.atscript',
          match: '"[^"]*"',
        },
        {
          name: 'string.quoted.single.atscript',
          match: "'[^']*'",
        },
        {
          name: 'constant.numeric.atscript',
          match: '\\b\\d+(\\.\\d+)?\\b',
        },
        {
          name: 'constant.language.boolean.atscript',
          match: '\\b(true|false)\\b',
        },
        {
          name: 'constant.language.null.atscript',
          match: '\\bnull\\b',
        },
        {
          name: 'variable.other.property.atscript',
          match: '[a-zA-Z_$][\\w$]*',
        },
        {
          name: 'punctuation.separator.comma.atscript',
          match: ',',
        },
        {
          name: 'keyword.operator.assignment.atscript',
          match: ':',
        },
        {
          begin: '\\{',
          end: '\\}',
          patterns: [
            {
              include: '#annotation-argument-value',
            },
          ],
        },
        {
          begin: '\\[',
          end: '\\]',
          patterns: [
            {
              include: '#annotation-argument-value',
            },
          ],
        },
      ],
    },
    'interface': {
      patterns: [
        {
          name: 'meta.interface.atscript',
          begin: '(?:export\\s+)?(interface)\\s+([a-zA-Z_$][\\w$]*)',
          beginCaptures: {
            1: { name: 'keyword.other.interface.atscript' },
            2: { name: 'entity.name.type.interface.atscript' },
          },
          end: '(?<=})',
          patterns: [
            {
              include: '#type-parameters',
            },
            {
              include: '#extends-clause',
            },
            {
              include: '#interface-body',
            },
          ],
        },
      ],
    },
    'type-alias': {
      patterns: [
        {
          name: 'meta.type.atscript',
          begin: '(?:export\\s+)?(type)\\s+([a-zA-Z_$][\\w$]*)',
          beginCaptures: {
            1: { name: 'keyword.other.type.atscript' },
            2: { name: 'entity.name.type.alias.atscript' },
          },
          end: '(?=;|$)',
          patterns: [
            {
              include: '#type-parameters',
            },
            {
              include: '#type-definition',
            },
          ],
        },
      ],
    },
    'type-parameters': {
      patterns: [
        {
          name: 'meta.type.parameters.atscript',
          begin: '<',
          end: '>',
          patterns: [
            {
              name: 'entity.name.type.parameter.atscript',
              match: '[a-zA-Z_$][\\w$]*',
            },
            {
              name: 'keyword.other.extends.atscript',
              match: '\\bextends\\b',
            },
            {
              include: '#type-reference',
            },
          ],
        },
      ],
    },
    'extends-clause': {
      patterns: [
        {
          name: 'meta.extends.atscript',
          begin: '\\bextends\\b',
          beginCaptures: {
            0: { name: 'keyword.other.extends.atscript' },
          },
          end: '(?={)',
          patterns: [
            {
              include: '#type-reference',
            },
          ],
        },
      ],
    },
    'interface-body': {
      patterns: [
        {
          name: 'meta.interface.body.atscript',
          begin: '{',
          end: '}',
          patterns: [
            {
              include: '#comments',
            },
            {
              include: '#annotations',
            },
            {
              include: '#property-declaration',
            },
          ],
        },
      ],
    },
    'property-declaration': {
      patterns: [
        {
          name: 'meta.property.atscript',
          match: '([a-zA-Z_$][\\w$]*)\\s*(\\?)?\\s*(:)\\s*([^;]+)',
          captures: {
            1: { name: 'variable.other.property.atscript' },
            2: { name: 'keyword.operator.optional.atscript' },
            3: { name: 'keyword.operator.type.annotation.atscript' },
            4: {
              patterns: [
                {
                  include: '#type-reference',
                },
              ],
            },
          },
        },
      ],
    },
    'type-reference': {
      patterns: [
        {
          name: 'support.type.primitive.extended.atscript',
          match:
            '\\b(number\\.int|number\\.float|string\\.email|string\\.url|string\\.uuid|string\\.date|string\\.datetime|string\\.time|string\\.duration|string\\.cron|string\\.base64|string\\.hex|string\\.json|string\\.xml)\\b',
        },
        {
          name: 'support.type.primitive.atscript',
          match: '\\b(string|number|boolean|any|void|never|unknown|object|symbol|bigint)\\b',
        },
        {
          name: 'entity.name.type.atscript',
          match: '[a-zA-Z_$][\\w$]*(?:\\.[a-zA-Z_$][\\w$]*)*',
        },
        {
          name: 'keyword.operator.type.atscript',
          match: '[|&]',
        },
        {
          begin: '\\[',
          end: '\\]',
          patterns: [
            {
              include: '#type-reference',
            },
          ],
        },
        {
          begin: '{',
          end: '}',
          patterns: [
            {
              include: '#property-declaration',
            },
          ],
        },
      ],
    },
    'type-definition': {
      patterns: [
        {
          begin: '=',
          beginCaptures: {
            0: { name: 'keyword.operator.assignment.atscript' },
          },
          end: '(?=;|$)',
          patterns: [
            {
              include: '#type-reference',
            },
          ],
        },
      ],
    },
    'imports': {
      patterns: [
        {
          name: 'meta.import.atscript',
          begin: '\\b(import)\\b',
          beginCaptures: {
            1: { name: 'keyword.control.import.atscript' },
          },
          end: '(?=;|$)',
          patterns: [
            {
              name: 'keyword.control.type.atscript',
              match: '\\btype\\b',
            },
            {
              name: 'keyword.control.from.atscript',
              match: '\\bfrom\\b',
            },
            {
              name: 'string.quoted.single.atscript',
              match: "'[^']+'",
            },
            {
              name: 'string.quoted.double.atscript',
              match: '"[^"]+"',
            },
            {
              name: 'variable.other.readwrite.atscript',
              match: '[a-zA-Z_$][\\w$]*',
            },
          ],
        },
      ],
    },
  },
}
