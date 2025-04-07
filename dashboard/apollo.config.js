/* eslint-env node */
module.exports = {
  client: {
    service: {
      name: 'codefox-backend1',
      localSchemaFile: './src/graphql/schema.gql'
    },
    includes: ['./src/**/*.{js,ts,tsx}'],
    excludes: ['**/__tests__/**']
  }
};
