// import * as fs from 'fs-extra';
// import * as path from 'path';
// import { FileGeneratorHandler } from '../handlers/file-manager/file-generate';
// import { Logger } from '@nestjs/common';
// import { isIntegrationTest } from 'src/common/utils';

// (isIntegrationTest ? describe : describe.skip)('FileGeneratorHandler', () => {
//   const projectSrcPath = path.normalize(
//     path.join('src', 'build-system', '__tests__', 'test-project'),
//   );

//   const mdFilePath = path.normalize(
//     path.join('src', 'build-system', '__tests__', 'file-arch.md'),
//   );

//   const structMdFilePath = path.normalize(
//     path.join('src', 'build-system', '__tests__', 'file-structure-document.md'),
//   );

//   beforeEach(async () => {
//     // Ensure the project directory is clean
//     await fs.remove(
//       path.normalize(
//         path.join('src', 'build-system', '__tests__', 'test-project', 'src'),
//       ),
//     );
//   });

//   afterEach(async () => {
//     // Clean up the generated test files
//     await fs.remove(
//       path.normalize(
//         path.join('src', 'build-system', '__tests__', 'test-project', 'src'),
//       ),
//     );
//   });

//   it('should generate files based on file-arch.md', async () => {
//     const archMarkdownContent = fs.readFileSync(
//       path.normalize(path.resolve(mdFilePath)),
//       'utf8',
//     );
//     const structMarkdownContent = fs.readFileSync(
//       path.normalize(path.resolve(structMdFilePath)),
//       'utf8',
//     );

//     const handler = new FileGeneratorHandler();

//     // Run the file generator with the JSON data
//     const result = await handler.generateFiles(
//       archMarkdownContent,
//       projectSrcPath,
//     );

//     Logger.log('File generation result:', result);

//     // Verify that all files exist
//     const jsonData = JSON.parse(
//       /<GENERATEDCODE>([\s\S]*?)<\/GENERATEDCODE>/.exec(
//         archMarkdownContent,
//       )![1],
//     );
//     const files = Object.keys(jsonData.files);

//     for (const file of files) {
//       const filePath = path.resolve(projectSrcPath, file);
//       expect(fs.existsSync(filePath)).toBeTruthy();
//     }
//   }, 30000);
// });
