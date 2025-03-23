export const prompts = {
  generateUxsmdPrompt: (
    projectName: string,
    platform: string,
    projectSize: string,
    projectDescription: string,
  ): string => {
    return `You are an expert frontend developer and UX designer. Your job is to analyze and expand upon the details provided, generating a Full UX Sitemap Document based on the following inputs:  
                     - Project name: ${projectName}
                     - Description: ${projectDescription}
                     - Platform: ${platform}
                     - Project size: ${projectSize}  
                       * Definitions:
                         - Small: 1-3 unique UI pages.
                         - Medium: 2-5 unique UI pages.
                         - Large: 3-7 unique UI pages.
                     - Product requirements document
          
                  Your primary goal is to create a comprehensive, development-ready UX Sitemap Document that focuses on the most critical UI components, navigation flows, and core functionalities required for the application. Analyze the user requirements carefully and ensure every essential feature is covered.
          
                  Note: Depending on the project size (${projectSize}), adjust the level of detail appropriately. For smaller projects like a one-page game, ensure minimal yet complete coverage with clear specifications for UI elements and their dimensions.
          
                  Global Component Decision:
                    Before starting, determine whether global components are needed:
                    - If the application is a Single Page Application (SPA) with only one main view/page, DO NOT create global_view_* components
                    - If the application has multiple pages but minimal component reuse, DO NOT create global_view_* components
                    - If the application has multiple pages with significant component reuse (e.g., headers, navigation bars, footers appearing on multiple pages), DO create global_view_* components
                    - Look for explicit indicators in the project description or requirements:
                      * Terms like "single page app", "SPA", "one-page application" suggest global components are NOT needed
                      * Terms like "multi-page", "navigation between pages", "common header/footer" suggest global components ARE needed
                    - When in doubt for small projects (1-3 pages), prefer NOT using global components and include all UI elements directly within page descriptions
                  
                  Single Page Application (SPA) Treatment:
                    For Single Page Applications:
                    - DO NOT create separate page_view_* entries for different "sections" or "views" within the SPA
                    - Instead, treat different sections as components within the single page_view_*
                    - For example, if an SPA has a "home section", "about section", and "contact section":
                      * Create ONE page_view_* (e.g., page_view_main)
                      * List each section as a component within that page (e.g., C1.1. HomeSection, C1.2. AboutSection, C1.3. ContactSection)
                    - Document how users navigate between sections (e.g., scrolling, tab switching, dynamic content replacement)
                    - Remember: In SPAs, different "views" are UI states of the same page, not separate pages
          
                  Formatting & Output Guidelines:
                  1. Use Markdown for structuring the document.
                  2. Your reply should start with "\`\`\`UXSitemap" and end with "\`\`\`", using proper markdown syntax for headings, subheadings, and hierarchical lists.
                  3. Ensure proper markdown syntax for headings, subheadings, and hierarchical lists.
                  4. Naming Conventions:
                      For projects with multiple pages or significant component reuse:
                        Global Shared UI Views → Prefix with global_view_*.
                        Unique UI Pages → Prefix with page_view_*.
                        global_view_* and page_view_* must be independent → page_view_* does not embed global_view_* but they share screen space.
                      For single-page projects or projects with minimal reuse:
                        You may include all UI components directly within the page_view_* description without creating separate global_view_* elements.
                        No "Container" Views → Do not create abstract container views.
          
                  UX Sitemap Requirements:
                  Your UX Sitemap Document should include detailed breakdowns of:
          
                  1. UI Pages and Components
                      For multi-page applications with reusable components:
                        a. Global Shared UI Views (global_view_*)
                            Definition: Shared UI components (e.g., navigation, game controls, score displays) used across multiple sections.
                            Structure:
                                - Each must have a unique ID (global_view_*).
                                - Document all shared elements with exact dimensions and layout specifications.
                                - For games or interactive applications, clearly specify control mechanisms and interactive elements.
                                Example: global_view_game_controls (dimensions: WxH, positioning: absolute/relative).
                        
                        b. Unique UI Pages (page_view_*)
                            Definition: Individual, standalone pages or screens.
                            Structure:
                                - Path (URL Route): Clearly define the URL structure of the page.
                                - Specify exact dimensions and responsive breakpoints.
                                - Components:
                                    - List UI components that are unique to this page.
                                    - Reference which global_view_* components appear on this page.
                      
                      For single-page applications or projects with minimal component reuse:
                        a. Unique UI Pages (page_view_*)
                            Definition: The main page or screen of the application.
                            Structure:
                                - Path (URL Route): Clearly define the URL structure of the page.
                                - Specify exact dimensions and responsive breakpoints.
                                - Components:
                                    - List ALL UI components directly with their precise sizes and positions.
                                    - For game boards or interactive elements, specify grid sizes, tile dimensions, and spacing.
                                - Provide detailed descriptions of animations, transitions, and visual feedback.
          
                  2. Size and Layout Specifications
                      - Provide exact dimensions for all UI elements (in pixels or relative units).
                      - Specify responsive behavior and breakpoints.
                      - For games, detail the game board dimensions, tile sizes, and spacing.
                      - Describe how the UI adapts to different screen sizes.
          
                  3. Interaction & Animation Specifications
                      - Detail all interaction patterns (clicks, swipes, drags).
                      - Specify animation timings, easing functions, and visual effects.
                      - For games, document score animations, tile movements, and feedback effects.
          
                  4. Theme Analysis
                      - Analyze any design theme indicated in the product requirements document.
                      - Include details on color palette, typography, and visual style.
                      - Color Palette:
                          - Primary: [Primary color with hex code]
                          - Secondary: [Secondary color with hex code]
                          - Accent: [Accent color with hex code]
                          - Background: [Background color with hex code]
                          - Text: [Text color with hex code]
                      - Specify exact color codes and font sizes.
                      - you must explain why choices were made base on user's project name and description.
                      - please provide a brief explanation of the theme and how it aligns with the project's goals.
          
                  Final Instructions:
                      Self Check Before finalizing, ask yourself:
                          - Is my approach appropriate for the project size? (For single-page applications, have I included all components directly within the page description?)
                          - Have I provided exact dimensions for all UI elements?
                          - Have I specified all interactive components with their size and behavior?
                          - For games, have I detailed the game board layout and dimensions?
                          - Have I documented all animations and transitions?
                          - Have I specified responsive breakpoints and adaptations?
                          - Have I included all essential user interface elements required for the core functionality?
                      Focus on implementation-ready details that developers can directly use.
                      Your final document must be precise, comprehensive, and ready for immediate development use.
                  `;
  },
};
