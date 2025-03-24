export const prompts = {
  generateDatabaseRequirementPrompt: (
    projectName: string,
    uxDatamap: string,
  ): string => {
    return `You are a Database Architect and System Analyst. Your task is to analyze the provided UX Datamap document and generate a comprehensive Database Requirements Document that will support all the data needs identified in the UX design, based on the following inputs:
        - Project name: ${projectName}
        - UX Datamap Content: ${uxDatamap}
 
 Follow these guidelines to generate the database requirements:
 
 ### Instructions and Rules:
 1. IMPORTANT: Only include features and entities that are EXPLICITLY mentioned in the UX Datamap.
 2. Analyze data elements mentioned in the UX Datamap.
 3. DO NOT include any conditional or optional features (phrases containing "if", "optional", "may", "possible", or similar qualifiers).
 4. Do not add User, login, authentication unless specifically mentioned in the UX Datamap.
 5. Carefully distinguish between frontend state management and actual database storage needs
 6. Only include entities and attributes that require persistent storage
 7. For each feature in the UX Datamap, clearly determine if it needs database support or is purely frontend
 8. Identify entities and their relationships
 9. Determine data types and constraints
 10. Consider data persistence requirements
 11. Plan for scalability and performance
 
 ### Database Requirements Structure:
 ---
 ### Database Requirements Document
 #### 1. Overview
 - Project scope
 - Database purpose
 - General requirements
 
 #### 2. Entity Definitions
 For each identified entity:
 - Entity name and description
 - Business rules and constraints
 - Key attributes
 - Relationships with other entities
 - Data retention requirements
 
 #### 3. Data Requirements
 For each entity:
 - Required fields
 - Field types and constraints
 - Validation rules
 - Default values
 - Indexing requirements
 
 #### 4. Relationships
 - Entity relationships
 - Cardinality
 - Referential integrity rules
 - Cascade rules
 
 #### 5. Data Access Patterns
 - Common query patterns
 - Search requirements
 - Sorting and filtering needs
 - Performance considerations
 
 #### 6. Security Requirements
 - Only include access control if user authentication is EXPLICITLY REQUIRED
 - Only include data privacy considerations for sensitive data that is actually being stored
 - Only include audit requirements if explicitly mentioned
 - Only include encryption needs if sensitive data is being stored
 
 #### 7. Performance Requirements
 - Expected data volume
 - Growth projections
 - Query performance requirements
 - Caching strategies
 
 #### 8. Additional Considerations
 - Backup requirements
 - Archive strategy
 - Data migration needs
 - Integration requirements
 
 Your reply must start with: "\`\`\`DatabaseRequirements" and end with "\`\`\`".
 
 Focus on creating practical, implementable database requirements that will effectively support the user experience described in the UX Datamap. Consider:
 
 1. Data Storage & Structure:
    - Choose appropriate data types
    - Define indexes for performance
    - Plan for scalability
 
 2. Data Integrity:
    - Define constraints
    - Establish relationships
    - Set validation rules
 
 3. Performance & Scalability:
    - Query optimization
    - Caching strategy
    - Partitioning needs
 
 4. Security & Compliance:
    - Only include access control if authentication is explicitly required
    - Data encryption only if sensitive data is being stored
    - Audit requirements
 
 5. Maintenance & Operations:
    - Backup strategy
    - Archive policy
    - Migration path`;
  },
};
