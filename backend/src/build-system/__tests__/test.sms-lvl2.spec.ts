// import { isIntegrationTest } from 'src/common/utils';
// import { PRDHandler } from '../handlers/product-manager/product-requirements-document/prd';
// import { ProjectInitHandler } from '../handlers/project-init';
// import { UXDMDHandler } from '../handlers/ux/datamap';
// import { UXSMDHandler } from '../handlers/ux/sitemap-document';
// import { UXSMSHandler as UXSMSHandler } from '../handlers/ux/sitemap-structure';
// import { UXSMSPageByPageHandler } from '../handlers/ux/sitemap-structure/sms-page';
// import { BuildSequence } from '../types';
// import { executeBuildSequence } from './utils';

// (isIntegrationTest ? describe : describe.skip)('Build Sequence Test', () => {
//   it('should execute build sequence successfully', async () => {
//     const sequence: BuildSequence = {
//       id: 'test-backend-sequence',
//       version: '1.0.0',
//       name: 'Spotify-like Music Web',
//       description: 'Users can play music',
//       databaseType: 'SQLite',
//       nodes: [
//         {
//           handler: ProjectInitHandler,
//           name: 'Project Folders Setup',
//           description: 'Create project folders',
//         },

//         {
//           handler: PRDHandler,
//           name: 'Project Requirements Document Node',
//         },

//         {
//           handler: UXSMDHandler,
//           name: 'UX Sitemap Document Node',
//         },

//         {
//           handler: UXSMSHandler,
//           name: 'UX Sitemap Structure Node',
//         },
//         {
//           handler: UXDMDHandler,
//           name: 'UX DataMap Document Node',
//         },
//         {
//           handler: UXSMSPageByPageHandler,
//           name: 'Level 2 UX Sitemap Structure Node details',
//         },
//       ],
//     };

//     const result = await executeBuildSequence('fullstack-code-gen', sequence);
//     expect(result.success).toBe(true);
//     expect(result.metrics).toBeDefined();
//   }, 300000);
// });
