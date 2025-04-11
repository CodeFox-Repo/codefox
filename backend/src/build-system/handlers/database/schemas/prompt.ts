/**
 * Collection of prompt functions used for various build system operations.
 */

export const prompts = {
  /**
   * Analyzes database requirements and generates a structured analysis.
   * @param projectName - The name of the project.
   * @param dbRequirements - The database requirements as a string.
   * @param databaseType - The type of the database (e.g., PostgreSQL, MongoDB, SQLite).
   * @returns A prompt string for the language model to perform the analysis.
   */
  analyzeDatabaseRequirements: (
    projectName: string,
    dbRequirements: string,
    databaseType: string = 'PostgreSQL',
  ): string => {
    return `You are a Database Architect specializing in ${databaseType}. Your task is to analyze the provided database requirements document and create a clear plan for schema generation. Use the following requirements as input:
 
${dbRequirements}
 
Generate a structured analysis describing what needs to be created for each database entity. Your reply must start with "<GENERATE>DBAnalysis" and end with "</GENERATE>".
 
For each entity in the requirements:
1. What tables/collections need to be created
2. What indexes are necessary
3. What constraints must be enforced
4. What relationships need to be established
 
Example output format:
 
DBAnalysis
Database: ${projectName}
Type: ${databaseType}

Entity: Users
- Primary table for user accounts
- Required fields: id, email, username, password_hash, subscription_type
- Unique constraints on email and username
- Indexes needed on email and username for quick lookup
- JSON/JSONB field for preferences
- Timestamps for created_at and updated_at

Entity: Playlists
- Primary table for playlist management
- Required fields: id, title, user_id, is_system_generated
- Foreign key relationship to Users
- Index on user_id for quick user playlist lookup
- Composite index on (user_id, title) for unique user playlists

[Continue for all entities...]

Required Junction Tables:
1. playlist_songs
   - Manages N:M relationship between playlists and songs
   - Needs position field for song order
   - Indexes on both foreign keys

2. song_genres
   - Manages N:M relationship between songs and genres
   - Indexes on both foreign keys

Performance Considerations:
1. User table needs hash indexes on email and username
2. Playlist_songs needs index on position for queue management
3. Songs table needs full text search capability
`;
  },

  /**
   * Generates the database schema based on the analysis, ensuring idempotency.
   * @param dbAnalysis - The database analysis as a string.
   * @param databaseType - The type of the database (e.g., PostgreSQL, MongoDB, SQLite).
   * @param fileExtension - The file extension to use for the schema file.
   * @returns A prompt string for the language model to generate the schema.
   */
  generateDatabaseSchema: (
    dbAnalysis: string,
    databaseType: string = 'PostgreSQL',
    fileExtension: string,
  ): string => {
    return `You are a Database Engineer specializing in ${databaseType}. Generate the complete database schema based on the following analysis, using appropriate ${databaseType} syntax and features:
 
Here is dbAnalysis content:
<GENERATE>
${dbAnalysis}
</GENERATE>
 
Rules for schema generation:
1. Use ${databaseType}-specific data types and features.
2. Ensure all schema operations are idempotent. For example:
   - Use "CREATE TABLE IF NOT EXISTS" for table creation.
   - Use "CREATE INDEX IF NOT EXISTS" for index creation (if supported by ${databaseType}).
   - Ensure foreign keys, constraints, and other objects are created without duplication.
3. Do not include any comments in the output.
4. Use standardized naming conventions.
5. Generate schema in the correct creation order for dependencies.

Rules for mock data generation:
1. After creating each table, add INSERT statements with 5-10 rows of realistic sample data.
2. Mock data should relate to the purpose of the appliaction.
3. Ensure referential integrity in the mock data (foreign keys reference valid primary keys).
4. Use realistic values appropriate for each column type and purpose.
5. For timestamp fields, use recent dates.
6. Include a variety of data scenarios to demonstrate different use cases.
7. Image Assets: If mock requires any images, you can use placeholder image URLs from https://picsum.photos/<width>/<height>. Note that the width and height values (e.g., 500/300) are adjustable as needed.

Example output:
<GENERATE>
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  subscription_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Mock data for users
INSERT INTO users (email, username, password_hash, subscription_type) VALUES
('user1@example.com', 'user1', 'hash1', 'premium'),
('user2@example.com', 'user2', 'hash2', 'free'),
('user3@example.com', 'user3', 'hash3', 'premium'),

CREATE TABLE IF NOT EXISTS playlists (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  user_id INT NOT NULL,
  is_system_generated BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);
</GENERATE>

Your reply must start with "<GENERATE>" and end with "</GENERATE>".`;
  },

  validateDatabaseSchema: (
    schemaContent: string,
    databaseType: string = 'PostgreSQL',
  ): string => {
    return `You are a Database Expert specializing in ${databaseType}. Your task is to analyze and fix any issues in the following database schema:
  
  ${schemaContent}
  
  As an expert database engineer, you should:
  1. Analyze the schema for any syntax errors, logical inconsistencies, or missing elements
  2. Fix any issues including:
     - Incorrect syntax or invalid ${databaseType} statements
     - Missing or incorrect dependencies
     - Improper foreign key relationships
     - Missing indexes for commonly queried fields
     - Non-idempotent operations
     - Incorrect data type usage
     - Missing constraints that should exist
     - Schema objects created in incorrect order
  
  You must provide your response in exactly this format:
  1. First, explain all issues found and fixes applied OUTSIDE of any GENERATE tags
  2. Then provide the complete fixed schema inside GENERATE tags
  3. The GENERATE tags must contain ONLY valid ${databaseType} schema code, no comments or explanations
  
  For example:
  
  Found and fixed the following issues:
  1. Added missing IF NOT EXISTS to table creation
  2. Fixed incorrect foreign key reference
  3. Added missing index on commonly queried field
  
  <GENERATE>
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL
  );
  
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  </GENERATE>`;
  },
};
