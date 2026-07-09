import { isIntegrationTest } from 'src/common/utils';
import { BuildSequence } from '../types';
import { ProjectInitHandler } from '../handlers/project-init';
import { PRDHandler } from '../handlers/product-manager/product-requirements-document/prd';
import { UXSMDHandler } from '../handlers/ux/sitemap-document';
import { UXSMSHandler } from '../handlers/ux/sitemap-structure';
import { DBRequirementHandler } from '../handlers/database/requirements-document';
import { UXDMDHandler } from '../handlers/ux/datamap';
import { BuilderContext } from '../context';
import { FrontendCodeHandler } from '../handlers/frontend-code-generate';
import { FileStructureAndArchitectureHandler } from '../handlers/file-manager/file-struct';
import { BackendRequirementHandler } from '../handlers/backend/requirements-document';
import { UIUXLayoutHandler } from '../handlers/ux/uiux-layout';
import { BackendCodeHandler } from '../handlers/backend/code-generate';
import { DBSchemaHandler } from '../handlers/database/schemas/schemas';

(isIntegrationTest ? describe : describe.skip)('Build Sequence Test', () => {
  it('should execute build sequence successfully', async () => {
    const sequence: BuildSequence = {
      id: 'test-backend-sequence',
      version: '1.0.0',
      name: 'No-Code AI Workflow Builder',
      description: `Generate a visual app where users drag blocks (e.g., 'Get Tweet' → 'Summarize with AI' → 'Post to Slack'), and it auto-generates the backend logic + UI.`,
      databaseType: 'SQLite',
      model: 'gpt-4o-mini',
      projectSize: 'medium', // limit for fun
      nodes: [
        {
          handler: ProjectInitHandler,
          name: 'Project Folders Setup',
        },
        {
          handler: PRDHandler,
          name: 'Project Requirements Document Node',
        },
        {
          handler: UXSMDHandler,
          name: 'UX Sitemap Document Node',
        },
        {
          handler: UXSMSHandler,
          name: 'UX Sitemap Structure Node',
          // requires: ['op:UX:SMD'],
        },
        {
          handler: UIUXLayoutHandler,
          name: 'UIUX Layout Handler',
          // requires: ['op:UX:SMD'],
        },
        {
          handler: UXDMDHandler,
          name: 'UX DataMap Document Node',
        },
        {
          handler: FileStructureAndArchitectureHandler,
          name: 'File Structure and Architecture',
        },
        {
          handler: DBRequirementHandler,
          name: 'Database Requirements Node',
          // requires: ['op:UX:DATAMAP:DOC'],
        },
        {
          handler: DBSchemaHandler,
          name: 'Database schema Node',
          // requires: ['op:UX:DATAMAP:DOC'],
        },
        {
          handler: BackendRequirementHandler,
          name: 'Backend Requirements Node',
          // requires: ['op:DATABASE_REQ', 'op:UX:DATAMAP:DOC', 'op:UX:SMD'],
        },
        {
          handler: BackendCodeHandler,
          name: 'Backend Code Generator Node',
        },
        {
          handler: FrontendCodeHandler,
          name: 'Frontend Code Generator Node',
        },
      ],
      packages: [],
    };
    const context = new BuilderContext(sequence, 'fullstack-code-gen');
    await context.execute();
  }, 2000000);
});
