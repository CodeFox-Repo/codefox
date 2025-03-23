import { BackendCodeHandler } from 'src/build-system/handlers/backend/code-generate';
import { BackendFileReviewHandler } from 'src/build-system/handlers/backend/file-review/file-review';
import { BackendRequirementHandler } from 'src/build-system/handlers/backend/requirements-document';
import { DBRequirementHandler } from 'src/build-system/handlers/database/requirements-document';
import { DBSchemaHandler } from 'src/build-system/handlers/database/schemas/schemas';
import { FrontendCodeHandler } from 'src/build-system/handlers/frontend-code-generate';
import { PRDHandler } from 'src/build-system/handlers/product-manager/product-requirements-document/prd';
import { ProjectInitHandler } from 'src/build-system/handlers/project-init';
import { UXDMDHandler } from 'src/build-system/handlers/ux/datamap';
import { UXSMDHandler } from 'src/build-system/handlers/ux/sitemap-document';
import { UXSMSHandler } from 'src/build-system/handlers/ux/sitemap-structure';
import { UXSMSPageByPageHandler } from 'src/build-system/handlers/ux/sitemap-structure/sms-page';
import { BuildSequence } from 'src/build-system/types';
import { v4 as uuidv4 } from 'uuid';
import { CreateProjectInput } from './dto/project.input';
import { FileStructureAndArchitectureHandler } from 'src/build-system/handlers/file-manager/file-struct';
import { UIUXLayoutHandler } from 'src/build-system/handlers/ux/uiux-layout';

export function buildProjectSequenceByProject(
  input: CreateProjectInput,
): BuildSequence {
  const sequence: BuildSequence = {
    id: uuidv4(),
    version: '1.0.0',
    name: input.projectName,
    description: input.description,
    databaseType: input.databaseType,
    packages: input.packages,
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
      },
      {
        handler: UIUXLayoutHandler,
        name: 'UI UX layout Node',
      },
      {
        handler: UXDMDHandler,
        name: 'UX DataMap Document Node',
      },
      {
        handler: DBRequirementHandler,
        name: 'Database Requirements Node',
      },
      {
        handler: FileStructureAndArchitectureHandler,
        name: 'File Structure and Architecture',
      },
      {
        handler: UXSMSPageByPageHandler,
        name: 'Level 2 UX Sitemap Structure Node details',
      },
      {
        handler: DBSchemaHandler,
        name: 'Database Schemas Node',
      },
      {
        handler: BackendRequirementHandler,
        name: 'Backend Requirements Node',
      },
      {
        handler: BackendCodeHandler,
        name: 'Backend Code Generator Node',
      },
      {
        handler: BackendFileReviewHandler,
        name: 'Backend File Review Node',
      },
      {
        handler: FrontendCodeHandler,
        name: 'Frontend Code Generator Node',
      },
    ],
  };
  return sequence;
}

/**
 * Generates a project name prompt based on the provided description.
 */
export function generateProjectNamePrompt(description: string): string {
  return `You are a project name generator specializing in creating clear, descriptive titles for technical projects. Based on the provided description, generate a concise yet comprehensive project title.

Input Description: ${description}

Project Title Guidelines:
1. Create a descriptive title (not exceeding 20 words)
2. Format as a standard phrase that clearly identifies the project purpose
3. Include specific details about:
   - The type of application (e.g., Backend, Frontend, Mobile App)
   - The industry or organization it serves
   - Key functionality or purpose
4. Ensure the title is:
   - Clear and descriptive
   - Professional and straightforward
   - Easy to understand for stakeholders
   - Specific enough to differentiate from other projects
5. Acceptable formatting examples:
   - "Backend System for Financial Reporting"
   - "Mobile App for Patient Monitoring"
   - "Data Analytics Platform for Retail Inventory"
6. Include organization names when relevant (e.g., "Backend App for Chinese Sakura Bank")

Please respond ONLY with the project title. Do not include explanations or additional text.

Example high-quality outputs:
Description: "A task management system with real-time collaboration features for marketing teams"
Output: Collaboration Platform for Marketing Task Management

Description: "An AI-powered document analysis system for legal departments"
Output: AI Document Analysis Tool for Legal Departments

Description: "A microservice-based e-commerce platform with advanced inventory management for a furniture retailer"
Output: E-commerce System for Furniture Inventory Management`;
}
