import { Language, Query, Tree } from 'web-tree-sitter';

import type {
  ParsedItem,
  ParsedToken,
  ResolvedParsedItem,
  TransformerForm,
} from './types';

// https://tree-sitter.github.io/tree-sitter/7-playground.html
const JAVA_QUERY = `
(class_declaration 
  name: (identifier) @class_name
  (type_parameters (type_parameter)* @generic_type)
)
(class_declaration 
  name: (identifier) @class_name
)
(
  field_declaration
  type: (generic_type
    (type_identifier) @generic_type
    (type_arguments
      [(type_identifier) (wildcard)] @generic_arg) 
    )
    declarator: (variable_declarator
    name: (identifier) @generic_name
  )
)
(
  field_declaration
    type: [
      (type_identifier)
      (integral_type)
      (floating_point_type)
      (boolean_type)
    ] @variable_type
    declarator: (variable_declarator
    name: (identifier) @variable_name
  )
)
(
  field_declaration
    type: (array_type
      element: (_) @variable_type
      dimensions: (dimensions) @array_dim
    ) 
    declarator: (variable_declarator
    name: (identifier) @variable_name
  )
)
(enum_declaration
  name: (identifier) @enum_name
  body: (enum_body
    (enum_constant) @enum_values
  )
)
`;

const JAVA_QUERY_INDEX_MAP: { [key: number]: ParsedToken } = {
  0: 'generic_class',
  1: 'class',
  2: 'generic',
  3: 'variable',
  4: 'variable_array',
  5: 'enum',
};

const parseType = (item: ParsedItem): Omit<ResolvedParsedItem, 'itemId'> => {
  const TYPE_MAP: Record<string, string> = {
    BigDecimal: 'number',
    BigInteger: 'number',
    bool: 'boolean',
    boolean: 'boolean',
    Boolean: 'boolean',
    byte: 'number',
    Byte: 'number',
    Calendar: 'string',
    char: 'string',
    Character: 'string',
    Currency: 'string',
    Date: 'string',
    double: 'number',
    Double: 'number',
    float: 'number',
    Float: 'number',
    int: 'number',
    Integer: 'number',
    LocalDate: 'string',
    LocalDateTime: 'string',
    Locale: 'string',
    LocalTime: 'string',
    long: 'number',
    Long: 'number',
    Object: 'object',
    offsetDateTime: 'string',
    OffsetDateTime: 'string',
    OffsetTime: 'string',
    short: 'number',
    Short: 'number',
    String: 'string',
    TimeZone: 'string',
    UUID: 'string',
    ZonedDateTime: 'string',
  };

  const MAP_TOKENS = ['Map', 'HashMap', 'LinkedHashMap', 'TreeMap'];
  const LIST_TOKENS = [
    'ArrayDeque',
    'ArrayList',
    'Deque',
    'HashSet',
    'LinkedList',
    'List',
    'Queue',
    'Set',
    'TreeSet',
  ];
  const NULLABLE_TOKENS = [
    'Optional',
    'OptionalDouble',
    'OptionalInt',
    'OptionalLong',
  ];
  switch (item.tag) {
    case 'variable': {
      const type = TYPE_MAP[item.type];
      return {
        variableName: item.name,
        isOptional: false,
        type: [
          {
            tag: 'base',
            name: type ?? item.type,
            isValid: Boolean(type),
            dim: 0,
          },
        ],
      };
    }

    case 'enum': {
      return {
        variableName: item.name,
        isOptional: false,
        type: item.values.map((value) => ({
          tag: 'base',
          name: value,
          isValid: true,
          dim: 0,
        })),
      };
    }

    case 'generic': {
      const type = TYPE_MAP[item.type];
      if (MAP_TOKENS.includes(item.type) && item.args.length === 2) {
        const [key, value] = item.args;
        return {
          variableName: item.name,
          isOptional: false,
          type: [
            {
              tag: 'map',
              name: item.name,
              isValid: Boolean(key) && Boolean(value),
              key: TYPE_MAP[key] ?? key,
              value: TYPE_MAP[value] ?? value,
              dim: 0,
            },
          ],
        };
      } else if (LIST_TOKENS.includes(item.type) && item.args.length === 1) {
        const listType = item.args[0];
        const type = TYPE_MAP[listType];
        return {
          variableName: item.name,
          isOptional: false,
          type: [
            {
              tag: 'base',
              name: type ?? listType,
              isValid: Boolean(type),
              dim: 1,
            },
          ],
        };
      } else if (
        NULLABLE_TOKENS.includes(item.type) &&
        item.args.length === 1
      ) {
        const optionalType = item.args[0];
        const type = TYPE_MAP[optionalType];
        return {
          variableName: item.name,
          isOptional: true,
          type: [
            {
              tag: 'base',
              name: type ?? optionalType,
              isValid: Boolean(type),
              dim: 0,
            },
          ],
        };
      }
      return {
        variableName: item.name,
        isOptional: false,
        type: [
          {
            tag: 'generic',
            name: item.name,
            args: item.args,
            isValid: Boolean(type),
            dim: 0,
          },
        ],
      };
    }
  }
};

const parseTree = (code: string, tree: Tree | null, lang: Language) => {
  let className: string = '';
  const parsedItems: { [key: string]: ParsedItem } = {};

  const root = tree?.rootNode;
  const superQuery = new Query(lang, JAVA_QUERY);
  if (root) {
    const superMatch = superQuery.matches(root);

    superMatch.forEach((match) => {
      switch (JAVA_QUERY_INDEX_MAP[match.patternIndex]) {
        case 'class': {
          const item = match.captures[0];
          className = code.substring(item.node.startIndex, item.node.endIndex);
          break;
        }
        case 'enum': {
          const [{ node: nameNode }, { node: valueNode }] = match.captures;
          const name = code.substring(nameNode.startIndex, nameNode.endIndex);
          const value = code.substring(
            valueNode.startIndex,
            valueNode.endIndex,
          );

          const key = `${name}:enum`;
          if (parsedItems[key] && parsedItems[key].tag === 'enum') {
            parsedItems[key].values.push(value);
          } else {
            parsedItems[key] = {
              tag: 'enum',
              name,
              values: [value],
              startPosition: nameNode.startIndex,
            };
          }
          break;
        }
        case 'generic': {
          const [{ node: typeNode }, { node: argNode }, { node: nameNode }] =
            match.captures;
          const name = code.substring(nameNode.startIndex, nameNode.endIndex);
          const type = code.substring(typeNode.startIndex, typeNode.endIndex);
          const arg = code.substring(argNode.startIndex, argNode.endIndex);
          const key = `${name}:${type}:generic`;
          if (parsedItems[key] && parsedItems[key].tag === 'generic') {
            parsedItems[key].args.push(arg);
          } else {
            parsedItems[key] = {
              name,
              type,
              args: [arg],
              tag: 'generic',
              startPosition: nameNode.startIndex,
            };
          }
          break;
        }
        case 'generic_class':
          break;
        case 'variable_array':
        case 'variable':
          {
            const dimIndex = match.captures.findIndex(
              (item) => item.name === 'variable_dim',
            );
            const nameIndex = match.captures.findIndex(
              (item) => item.name === 'variable_name',
            );
            const typeIndex = match.captures.findIndex(
              (item) => item.name === 'variable_type',
            );

            if (nameIndex !== -1 && typeIndex !== -1) {
              const nameNode = match.captures[nameIndex].node;
              const typeNode = match.captures[typeIndex].node;
              const dimNode =
                dimIndex !== -1 ? match.captures[dimIndex].node : null;

              const name = code.substring(
                nameNode.startIndex,
                nameNode.endIndex,
              );
              const type = code.substring(
                typeNode.startIndex,
                typeNode.endIndex,
              );
              const dim = dimNode
                ? code
                    .substring(dimNode.startIndex, dimNode.endIndex)
                    .replaceAll('[', '').length
                : 0;
              const key = `${name}:${type}:variable`;
              if (!parsedItems[key]) {
                parsedItems[key] = {
                  name,
                  type,
                  dim,
                  tag: 'variable',
                  startPosition: nameNode.startIndex,
                };
              }
            }
          }
          break;
      }
    });
  }

  return {
    className,
    parsedItems,
  };
};

const generateTypescript = ({
  classifier,
  typeName,
  parsedItems,
  export: shouldExport,
}: Pick<
  TransformerForm,
  'classifier' | 'typeName' | 'parsedItems' | 'export'
>) => {
  return (
    `${shouldExport ? 'export ' : ''}` +
    `${classifier} ` +
    `${typeName}${classifier === 'type' ? ' =' : ''} {\n` +
    parsedItems
      .map((item) => {
        const typeDefinition = item.type
          .map((t) => {
            let typeName = '';
            switch (t.tag) {
              case 'base':
                typeName = t.name;
                break;
              case 'generic':
                typeName = `${t.name}<${t.args.join(', ')}>`;
                break;
              case 'map':
                typeName = `{ [key: ${t.key}]: ${t.value} }`;
                break;
              default:
                typeName = 'any';
            }
            return `${typeName}${'[]'.repeat(t.dim || 0)}`;
          })
          .join(' | ');

        return `  ${item.variableName}${item.isOptional ? '?' : ''}: ${typeDefinition};`;
      })
      .join('\n') +
    '\n};'
  );
};

export const JAVA_CONFIG = {
  query: JAVA_QUERY,
  indexMap: JAVA_QUERY_INDEX_MAP,
  parse: parseType,
  parseTree,
  generateTypescript,
};
