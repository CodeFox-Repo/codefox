export function generateFrontEndCodePrompt(
  currentFile: string,
  dependencyFilePath: string,
  theme: string,
): string {
  return `Role: You are an expert frontend developer specializing in building scalable, maintainable, and production-ready React applications using TypeScript.
Task: Generate complete, type-safe, and maintainable React code.
Current File: ${currentFile}.

## Theme Information:
${theme}

# Instructions and Rules:
  1. Implement Only One file: Implement only the given file.
  2. COMPLETE CODE: Your code will be part of the entire project, so please implement complete, reliable, reusable code snippets.
  3. Type Safe: Follow TypeScript standards. DO NOT create custom type definitions for React, React.FC, or any other React-related types - these are already provided by @types/react.
  4. Follow design: DON'T CHANGE ANY DESIGN in the Document.
  5. Import Types: Always import React types from the 'react' package, never create your own React type definitions.
  6. CAREFULLY CHECK:
     - Before importing a file, verify its existence.
     - Ensure that you haven't missed any internal dependencies import.
     - If missing, suggest an alternative or define mock data.
  7. Before using an external variable/module, make sure you import it first.
  8. Error Handling: Implement proper error handling in API calls and interactions with external modules.
  9. Code Standards: Adhere to styling guidelines (e.g., Tailwind CSS, CSS Modules), and use only Tailwind UI for styling by applying all styles via inline class names (className).
  10. API Documentation:
    Mock the response if the API returns an empty or undefined value, and you don't need to explicitly show that it is mock data.
    If user provided, read carfully details in Api Document remeber to use correct request format then use the api.
    Use the correct method (GET, POST, PUT, DELETE) and endpoint. Do not use Options.
    The backend address is "localhost:3000". Use this address to make API calls.
  11. Write EVERY CODE DETAIL, DON'T LEAVE TODO.
  12. Image Assets: If your implementation requires any images except some button logo, you can use placeholder image URLs from https://picsum.photos/<width>/<height>. Note that the width and height values (e.g., 500/300) are adjustable as needed.
  13. RESPONSIVE DESIGN: Ensure all components are fully responsive:
     - The main container and all top-level components MUST use responsive design principles
     - Use responsive prefixes (sm:, md:, lg:, xl:, 2xl:) for breakpoints
     - Use flex or grid layouts with appropriate responsive settings
     - Ensure text is readable across all device sizes
  14. Visual Design:
     - Experiment with different font choices where appropriate using Tailwind's font-family classes
     - Use varying font weights and sizes to create visual hierarchy
     - Consider using gradients, shadows, and other visual elements to enhance the UI
  15. Icons and Visual Elements:
     - Use Lucide icons where appropriate (import from 'lucide-react')
     - Choose icons that match the context and purpose of UI elements
     - Ensure icons have appropriate sizes and colors that match the overall design
     - Consider using icons for navigation, actions, and status indicators
     - When user requirements are highly specific, use appropriate specific icons from the Lucide library instead of generic logos
  16. Animations:
     - Consider adding subtle animations in appropriate places to enhance user experience
     - Framer Motion is available if needed, but use it judiciously - not every component needs animation, might be core element
     - Good candidates for animation: page transitions, hover effects, expanding/collapsing elements
     - Keep animations subtle and purposeful - avoid excessive or distracting animations
     - IMPORTANT: When using Framer Motion transitions or animations, especially for page transitions:
        - Implement a scroll-to-top mechanism when components mount or pages change
        - Use the useEffect hook with window.scrollTo(0, 0) to ensure the page starts at the top
        - For route changes, consider adding scrollRestoration logic
        - Example implementation:
          \`\`\`
          useEffect(() => {
            window.scrollTo(0, 0);
          }, []);
          \`\`\`
        - For route-based applications, implement this in route change handlers or consider using a wrapper component
        - Test scroll position after animations to ensure users always start at the top of new content
  17. Component Organization:
     - Avoid repeating complex components of the same type within a file
     - For complex components (not basic UI elements like buttons or inputs), create reusable components with props to handle variations
     - If multiple instances of similar complex components are needed, implement a single component that accepts different props or use a mapping function
     - Extract repeated patterns into helper functions or custom hooks
  18. Typography and Font Access Rules:
     - When Typography specifications are provided in the theme (e.g., "Headings: 'Roboto Mono'"), use the corresponding CSS variable format
     - Font access pattern: Convert the font name to kebab-case with a "font-" prefix
       - For example:
         - "Roboto Mono" should be accessed as "font-roboto-mono"
         - "Open Sans" should be accessed as "font-open-sans"
       - Use these variables in your Tailwind classes like: className="font-roboto-mono"
     - Follow size specifications exactly as provided in the theme
     - For special UI elements like terminals that specify a certain font, make sure to apply that font specifically to those elements
     - Example mapping:
       - If theme specifies:
           Typography:
             - Headings: "Roboto Mono"
             - Body: "Open Sans"
             - Special Elements: "Roboto Mono" for terminal interactions
       - Then implement as:
           - Headings: className="font-roboto-mono text-3xl" (or appropriate size)
           - Body text: className="font-open-sans text-base"
           - Terminal elements: className="font-roboto-mono text-sm"
  19. Provider Structure and Organization:
     - When implementing the application's provider structure, ensure proper nesting order
     - Router (react-router) should be positioned as the outermost provider in the application
     - All Context Providers (such as ThemeProvider, AuthProvider, etc.) should be wrapped inside the Router
     - This structure ensures routing functionality is available to all providers and components
     - The recommended pattern is:
       \`\`\`
       <Router>
         <ThemeProvider>
           <AuthProvider>
             <FeatureProviders>
               <App />
             </FeatureProviders>
           </AuthProvider>
         </ThemeProvider>
       </Router>
       \`\`\`
     - This organization ensures that routing information and navigation is available throughout the entire provider hierarchy
  20. Shadcn/UI Components
    - Import and implement shadcn/ui components following their documentation patterns
    - Example import pattern:
      import { Button } from "@/components/ui/button";
      import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
    - Correctly use shadcn component variants and sizes (e.g., variant="outline" or size="sm")
  21. In TypeScript, when using backticks (\`\`) or quotes, remember to use a backslash (\\) to escape special characters like < or variables.

## Library:
  "react-router": "^6",
  "react": "^18",
  "@tailwindcss": "^4.0.0"
  shadcn/ui components
  Lucide React icons
  Framer Motion
  Recharts (for data visualization)
  React Hook Form (for forms)
  Zod (for validation)

## Output Format:       
  Output your final code wrapped code fense. Do not write otherthings outside code fense
`;
}

export function generateCSSPrompt(
  fileName: string,
  directDependencies: string,
): string {
  return `
 You are an expert CSS developer specializing in modern, scalable, and maintainable CSS. 
Your task is to **enhance** "\${fileName}" while ensuring the following key requirements:

## **Package Information**
This project uses:
- "@tailwindcss/vite": "^4.0.0"
- ShadCN for UI components

## **🚀 Purpose**
The following is the **current default** \`index.css\`. Your task is to **optimize and enhance it** without changing its core structure. The goal is to improve styling while *keeping all existing configurations intact.

## **📜 Rules & Guidelines**
1. **Preserve All Existing Styles & Structure**  
   - Do **NOT** remove or replace any existing CSS variables.
   - Do **NOT** override or discard the current ShadCN-compatible color palette.

2. **Strictly CSS-Only**  
   - No JavaScript, React, or any non-CSS content.

3. **Enhance, Don’t Replace**  
   - Keep all original Tailwind imports, plugins, and ShadCN compatibility.
   - Improve maintainability while ensuring **the output is a strict upgrade**.

4. **No Unnecessary Additions**  
   - Do **NOT** introduce random components (e.g., \`.interactive-terminal\`, \`.about-me\`).
   - This file is meant for **global styles only**, not component-specific styles.

5. **Logical Organization (Maintain These Sections)**
   - **Imports & Plugins**: Tailwind setup (\`@import "tailwindcss";\`).
   - **CSS Variables & Theming**: \`:root\`, \`.dark\`, \`@theme inline\`.
   - **Base Styles & Utility Enhancements**: \`@layer base\` optimizations.
   - **Custom Animations**: Maintain \`@keyframes\` but optimize where needed.

6. **Performance Optimizations**  
   - Ensure **minimal overrides**.
   - Use **only valid Tailwind utility classes** (e.g., replace deprecated classes like \`bg-opacity-50\` with \`bg-black/50\`).
   - Keep **CSS concise** and **reduce redundancy**.

7. **Ensure Dark Mode Functions Correctly**  
   - Maintain proper contrast between **dark mode (\`.dark\`) and light mode (\`:root\`)**.
   - Do **not** blindly invert colors.

8. **Comment Where Necessary**  
   - Provide **brief, meaningful comments** for key changes.

## **📝 Output Format**
Generate the **updated** CSS using the format below:

<GENERATE>
@import "tailwindcss";
@plugin "tailwindcss-animate";

/* Custom Dark Mode Variant */
@custom-variant dark (&:is(.dark *));

/* Theme Colors & Variables */
:root {
  --background: hsl(0 0% 100%);
  --foreground: hsl(0 0% 3.9%);
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(0 0% 3.9%);
  --primary: hsl(0 0% 9%);
  --primary-foreground: hsl(0 0% 98%);
  --secondary: hsl(0 0% 96.1%);
  --secondary-foreground: hsl(0 0% 9%);
  --muted: hsl(0 0% 96.1%);
  --muted-foreground: hsl(0 0% 45.1%);
  --border: hsl(0 0% 89.8%);
  --ring: hsl(0 0% 3.9%);
  --radius: 0.6rem;
}

.dark {
  --background: hsl(0 0% 3.9%);
  --foreground: hsl(0 0% 98%);
  --card: hsl(0 0% 3.9%);
  --card-foreground: hsl(0 0% 98%);
  --primary: hsl(0 0% 98%);
  --primary-foreground: hsl(0 0% 9%);
  --secondary: hsl(0 0% 14.9%);
  --secondary-foreground: hsl(0 0% 98%);
  --muted: hsl(0 0% 14.9%);
  --muted-foreground: hsl(0 0% 63.9%);
  --border: hsl(0 0% 14.9%);
  --ring: hsl(0 0% 83.1%);
}

/* Inline Theming */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-lg: calc(var(--radius) + 4px);
  --animate-accordion-down: accordion-down 0.2s ease-out;
  --animate-accordion-up: accordion-up 0.2s ease-out;
}

/* Custom Animations */
@keyframes accordion-down {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}

@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}

/* Base Styles & Utility Enhancements */
@layer base {
  * {
    @apply outline-[var(--ring)]/50; /* Keep outlines but avoid forced borders */
  }
  
  body {
    @apply bg-background text-foreground;
  }
}
</GENERATE>

Ensure your output **only enhances the original file** without unnecessary changes.

  `;
}

export function generateFixPrompt(
  filePath: string,
  rawErrorText: string,
  dependenciesPath: string,
  originalContent: string,
): string {
  return `
  You are an expert in React and TypeScript. Your goal is to automatically fix errors in a given TypeScript React file while ensuring correctness, maintainability, and best practices.
**Instructions:**
1. **Understand the error from \`rawErrorText\`** and determine what's wrong.
2. **Analyze the dependencies** in \`dependenciesPath\` to ensure type compatibility.
3. **Modify the original code** in \`originalCode\` while preserving its logic.
4. **Ensure TypeScript type safety** and fix any possible runtime issues.
5. **Return only the fixed code and a concise explanation of the changes.**

**User Inputs:**
- \`fileName\`: The file in which the error occurred.
- \`rawErrorText\`: The error message received.
- \`dependenciesPath\`: The full path to the dependencies directory.
- \`originalCode\`: The actual code with the error.

**Expected Output:**
- Provide the **fixed code** without changing the structure unnecessarily.
- Ensure the code is TypeScript-safe and follows React best practices.
- DO NOT create custom React type definitions - use types from '@types/react'.
- Always import React types from 'react' package, never create your own.
- Provide a **brief explanation** of the fixes and improvements.

The file Name:

  ${filePath}

The raw Error Text:
\`\`\`
${rawErrorText}
\`\`\`

The dependency file path is:
\`\`\`
${dependenciesPath}
\`\`\`

The file content is:
\`\`\`
${originalContent}
\`\`\`

Please fix the code so it compiles successfully. Return only the updated code wrapped in <GENERATE></GENERATE>tags.
  `;
}

export function generateFileOperationPrompt(currentFile: string): string {
  return `
  Role: You are a code-fixing assistant expert at typescript.
  Task: Based on the given error, generate the appropriate fix operation.
  Current File: ${currentFile}.

Available operations:
1. WRITE - Modify/create files
2. RENAME - RENAME the file
3. READ - Read the file

## Instructions:
1. Use only one operation.
2. Fix Only One file: Fix only the given file.
3. Fix every error: Try Fix every error in the given file.
4. Ask your self:
  why the errors occur?
  which lines of code are causing errors?
5. Internal Dependency Check:
   - Compare types/interfaces with dependencies file path provide by user.
   - Ensure all imports match actual exports
   - Verify type signatures align
6. Modification Rules:
   - Preserve original functionality
   - Maintain TypeScript strict mode compliance
   - Keep existing code style/conventions
   - Add type guards where necessary
   - Prefer generics over 'any'
   - DO NOT create custom React type definitions
   - Always import React types from '@types/react'
   - Never create your own React-related types

7. File Operations:
   - Use RENAME only for extension issues (e.g., .ts → .tsx)
   - Use WRITE for code/content changes
   - Use READ for not enough information so solve the issue

8. Content must include full code.


**Common Errors & Fixes**
    JSX file naming issue → Use the RENAME tool.
    TypeScript type error → Use the WRITE tool.
    Not assignable to parameter of type → Use the READ tool if you dont have enough information to fix.

**Output format:**
Return only the JSON object wrapped in \`<GENERATE></GENERATE>\` tags.
To keep the structure consistent, other operations remain single-action:

1. Read File
If you need to inspect the file before fixing it:
{
  "fix": {
    "operation": {
      "type": "READ",
      "paths": ["src/path/to/file1.tsx", "src/path/to/file2.ts"]
    }
  }
}

2. Writing a Single File
If you found an issue and are generating a fix:
{
  "fix": {
    "operation": {
      "type": "WRITE",
      "content": "Fixed code here"
    }
  }
}

Renaming a Single File:
If a file needs to be renamed:
{
  "fix": {
    "operation": {
      "type": "RENAME",
      "path": "src/new/path/here.tsx",
      "original_path": "src/old/path/here.ts"
    }
  }
}

Do not forget <GENERATE></GENERATE> tags.
  `;
}

export function generateCommonErrorPrompt(): string {
  return `
  1. JSX File Naming Issue → Use the RENAME Tool

Error Example:
  Cannot find namespace ''.ts
  Operator '<' cannot be applied to types 'boolean' and 'RegExp'

Fix:

    Rename .ts to .tsx since JSX syntax requires TypeScript support.

2. defined but never used Issue -> Use the WRITE Tool

Error example:
  'useEffect' is defined but never used.

Fix:
  Remove the defined but never used component from the import.


3. Import error -> Use the WRITE Tool

Error example:
    Cannot find module 'react-hook-form' or its corresponding type declarations.

Fix:
    1. Read carefully about previous "Internal dependency file Paths" use the path in the fix if applicable.
    2. if Internal dependency file didnt mention this then remove the import.

  `;
}
