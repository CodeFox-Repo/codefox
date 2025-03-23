// import { BuildSequence } from '../types';
// import * as fs from 'fs';
// import { executeBuildSequence } from './utils';
// import { isIntegrationTest } from 'src/common/utils';
// import { PRDHandler } from '../handlers/product-manager/product-requirements-document/prd';
// import { UXSMDHandler } from '../handlers/ux/sitemap-document';
// import { DBRequirementHandler } from '../handlers/database/requirements-document';
// import { DBSchemaHandler } from '../handlers/database/schemas/schemas';
// import { BackendCodeHandler } from '../handlers/backend/code-generate';
// import { ProjectInitHandler } from '../handlers/project-init';
// (isIntegrationTest ? describe : describe.skip)(
//   'Sequence: PRD -> UXSD -> UXDD -> UXSS -> DBSchemas -> BackendCodeGenerator',
//   () => {
//     // Generate a unique folder with a timestamp
//     const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//     const logFolderPath = `./logs/backend_code_generator-${timestamp}`;
//     fs.mkdirSync(logFolderPath, { recursive: true });

//     (isIntegrationTest ? it : it.skip)(
//       'should execute the backend code generation sequence and log results to individual files',
//       async () => {
//         // Define the build sequence up to Backend Code Generator
//         const sequence: BuildSequence = {
//           id: 'test-backend-sequence',
//           version: '1.0.0',
//           name: 'Spotify-like Music Web',
//           description: 'Users can play music',
//           databaseType: 'SQLite',
//           nodes: [
//             {
//               handler: ProjectInitHandler,
//               name: 'Project Folders Setup',
//             },
//             {
//               handler: PRDHandler,
//               name: 'PRD Generation Node',
//             },

//             {
//               handler: UXSMDHandler,
//               name: 'UX Sitemap Document Node',
//               // requires: ['op:PRD'],
//             },

//             {
//               handler: UXSMDHandler,
//               name: 'UX Data Map Document Node',
//               // requires: ['op:UX:SMD'],
//             },

//             {
//               handler: DBRequirementHandler,
//               name: 'Database Requirements Node',
//               // requires: ['op:UX:DATAMAP:DOC'],
//             },

//             {
//               handler: DBSchemaHandler,
//               name: 'Database Schemas Node',
//               // requires: ['op:DATABASE_REQ'],
//             },

//             {
//               handler: BackendCodeHandler,
//               name: 'Backend Code Generator Node',
//               // requires: ['op:DATABASE:SCHEMAS', 'op:UX:DATAMAP:DOC'],
//             },
//           ],
//         };

//         // Initialize the BuilderContext with the defined sequence and environment
//         executeBuildSequence('backend code geneerate', sequence);
//       },
//       600000,
//     ); // Timeout set to 10 minutes
//   },
// );
