import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: './src/graphql/schema.gql',
  ignoreNoDocuments: true,
  generates: {
    'src/graphql/type.tsx': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-resolvers',
        'typescript-react-apollo'
      ],
      config: {
        withHooks: true,
        useIndexSignature: true,
        enumsAsTypes: true,
        constEnums: true,
        skipTypename: false,
        dedupeOperationSuffix: true,
        nonOptionalTypename: true,
        preResolveTypes: true,
        namingConvention: {
          enumValues: 'keep'
        },
        scalars: {
          Date: 'Date'
        }
      }
    }
  },
  hooks: {
    afterOneFileWrite: ['prettier --write'],
    afterAllFileWrite: ['echo "✨ GraphQL types generated successfully"']
  },
  watch: ['./src/graphql/schema.gql']
};

export default config;
