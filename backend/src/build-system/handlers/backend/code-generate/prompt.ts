export const generateBackendCodePrompt = (
  projectName: string,
  databaseType: string,
  currentFile: string,
  fileType: string = 'Javascript',
  dependencyFile: string,
): string => {
  const defaultDependencies = {
    sqlite3: '^5',
    express: '^4',
    jsonwebtoken: '^9',
  };

  // Parse dependency file if provided, otherwise use defaults
  // TODO: get dependencies info from embedding model
  let dependencies;
  try {
    dependencies = dependencyFile
      ? JSON.parse(dependencyFile)
      : defaultDependencies;
  } catch (error) {
    dependencies = defaultDependencies;
  }

  return `Role: You are an expert backend developer. 
      Task: Your task is to generate a complete backend codebase within a single file for a project named "${projectName}". The code should be written using the Express framework with ES Module syntax (using \`import\` statements), and the database is ${databaseType}. The code must be written in \`${fileType}\`. The backend code should be scalable, maintainable, and adhere to best practices.
      Current File: ${currentFile}.

        ### Project Dependencies
        The project uses the following dependencies:
        \`\`\`json
        ${JSON.stringify(dependencies, null, 2)}
        \`\`\`
  
       ### Backend Requirements Analysis:
       Based on the provided backend requirements document, ensure implementation of:
       - All specified API endpoints and their functionality
       - Required authentication and authorization mechanisms
       - Specific business logic requirements
       - Data validation rules
       - Response formats and status codes
       - Rate limiting and security measures if specified
       - Required integrations with external services
       - Performance requirements and optimization needs
  
       ### Instructions and Rules:
       
       **Include:**
       1. **Server Setup:**
          - Initialize the server using the Express framework with ES Module syntax (use \`import\` instead of \`require\`).
          - Configure middleware for JSON parsing and CORS example "app.use(cors()); "
   
       2. **Database Connection and Initialization:**
          Database schemas: These schemas are defined in \`./schema.sql\`. The code must read and execute this file during database initialization.
          For SQLite database initialization, you must include code to execute the ./schema.sql file. There are several approaches:
  
          1. Using better-sqlite3:
          \`\`\`${fileType}
          // Direct execution
          db.exec(fs.readFileSync('./schema.sql', 'utf-8'));
          \`\`\`
  
          2. Using sqlite3 CLI:
          \`\`\`${fileType}
          // Execute using sqlite3 CLI
          import { exec } from 'child_process';
          exec('sqlite3 database.sqlite < ./schema.sql', (error, stdout, stderr) => {
            if (error) {
              Logger.error('Error executing schema:', error);
              return;
            }
          });
          \`\`\`
  
          3. Using node-sqlite3:
          \`\`\`${fileType}
          // Read and execute SQL file
          const initSchema = fs.readFileSync('./schema.sql', 'utf-8');
          db.exec(initSchema, (err) => {
            if (err) {
              Logger.error('Error executing schema:', err);
              return;
            }
          });
          \`\`\`
  
          **Important Database Considerations:**
          - Schema execution must happen during application startup
          - Add proper error handling for schema execution
          - Database file path should be configurable via environment variables
          - Consider adding checks to prevent re-running schema if tables exist
          - Enable foreign key constraints
          - Implement connection pooling if needed
  
       3. **Implementation Guidelines for SQLite:**
        1. **Basic Database Operations:**
        \`\`\`${fileType}
        // Using sqlite3
        import sqlite3 from 'sqlite3';
        const db = new sqlite3.Database('./database.sqlite');
    
        // Basic query example
        db.all("SELECT * FROM users", [], (err, rows) => {
          if (err) throw err;
          console.log(rows);
        });
        \`\`\`
    
        2. **Performance-Critical Operations:**
        \`\`\`${fileType}
        // Using better-sqlite3
        import Database from 'better-sqlite3';
        const db = new Database('database.sqlite', { verbose: console.log });
    
        // Prepared statement example
        const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
        const user = stmt.get(userId);
        \`\`\`
   
       4. **Route Definitions:**
          - Define RESTful API endpoints based on the sitemap documentation.
          - Implement example routes (e.g., GET /api/users, POST /api/users) that interact with the database.
          - Ensure proper validation for incoming requests.
   
       5. **Controllers, Models, and Services:**
          - Create prepared statements in service layer for better performance.
          - Use transactions where appropriate for data consistency.
          - Implement proper parameter binding for all database operations.
          - Services should handle all database interactions.
          - Controllers should only handle HTTP logic and call services.
   
       6. **Error Handling:**
          - Implement centralized error handling middleware.
          - Add specific error handling for database operations.
          - Ensure error messages are meaningful and appropriate for clients.
          - Include proper logging for errors.
   
       7. **Environment Configuration:**
          - Use dotenv or similar for environment variables.
          - Database configuration should be environment-based.
          - Server port is 3000 and other settings should be configurable.
   
       8. **Comments and Documentation:**
          - Add comments explaining each section and key code blocks.
          - Document the database initialization process.
          - Include examples of how to use the service functions.
          - Add API endpoint documentation.
   
       **Do Not Include:**
       - Inline or hardcoded SQL queries in the application code.
       - Complex business logic beyond basic CRUD operations.
       - Manual schema modifications outside of schema.sql file.
       - Hardcoded configuration values.
   
       **Special Requirements:**
       - Ensure all database operations are wrapped in appropriate error handling.
       - Implement proper logging throughout the application.
   
       ### Ask Yourself:
       1. Is the database initialization process robust and idempotent?
       2. Are prepared statements used consistently throughout the code?
       3. Is proper error handling implemented for all operations?
       4. Are transactions used appropriately for data consistency?
       5. Is the schema.sql file properly loaded and executed?
       6. Are all configurations properly externalized?
       7. Is there adequate logging and error tracking?
   
       ### Output Format:
       
       Provide the backend code within \`<GENERATE>\` tags as follows:
       
       <GENERATE>
       // Your generated backend code goes here
       </GENERATE>
       `;
};

export const generateForMultiFileBackendCodePrompt = (
  projectName: string,
  databaseType: string,
  currentFile: string,
  fileType: string = 'javascript',
  dependencyFile: string,
): string => {
  const defaultDependencies = {
    sqlite3: '^5',
    express: '^4',
  };

  // Parse dependency file if provided, otherwise use defaults
  // TODO: get dependencies info from embedding model
  let dependencies;
  try {
    dependencies = dependencyFile
      ? JSON.parse(dependencyFile)
      : defaultDependencies;
  } catch (error) {
    dependencies = defaultDependencies;
  }

  return `Role: You are an expert backend developer. 
      Task: Your task is to generate a complete backend codebase using Express framework, database ${databaseType}, and language Javascript. The backend code should be scalable, maintainable, and adhere to best practices.
      Current File: ${currentFile}. 

        ## Project External Dependencies
        The project uses the following dependencies:
        \`\`\`json
        ${JSON.stringify(dependencies, null, 2)}
        \`\`\`

        
  
        ### Instructions and Rules:
        1. Implement Only One file: Implement only the file specified in "Current File" - do not generate code for multiple files.
        2. COMPLETE CODE: Your code will be part of the entire project, so please implement complete, reliable, reusable code with no TODOs or placeholders.
        3. ES Module Syntax: Use ES Module syntax (import/export) consistently throughout the code.
        4. File Structure and Dependencies: The current file might depend on other files in the project use the Project Internal Dependencies to help you.
        5. CAREFULLY CHECK:
          - Before importing a file, verify that the file should logically exist
          - Ensure that you haven't missed any internal dependencies import
        6. Error Handling: Implement comprehensive error handling for database operations, API calls, and all async operations.
        7. Database Specific: For ${databaseType}, ensure you're using appropriate connection methods and query formats.
        8. Configuration: Use environment variables for sensitive values and configuration (use process.env)
        9. RESTful Standards: When implementing controllers and routes, follow RESTful API standards.
        10. Documentation: Include JSDoc comments for functions and important code sections.
        11. Logging: Implement appropriate logging for errors and significant operations.
        12. Schema Init: For database files, ensure proper initialization of tables and schemas if needed.
   
       ### Ask Yourself:
       1. Are all configurations properly externalized?
       2. Is the code properly typed with TypeScript?
       3. Is there adequate logging and error tracking?
   
       ### Output Format:
       
       Provide the backend code within \`<GENERATE>\` tags as follows:
       
       <GENERATE>
       // Your generated backend code goes here
       </GENERATE>
       `;
};
