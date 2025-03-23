// // TODO: adding virtual dir example here

// import * as fs from 'fs-extra';
// import * as path from 'path';
// import { VirtualDirectory } from '../virtual-dir';
// import { Logger } from '@nestjs/common';
// import { isIntegrationTest } from 'src/common/utils';

// // TODO: skip for now, some bug here
// (isIntegrationTest ? describe : describe.skip)('VirtualDirectory', () => {
//   const structMdFilePath = path.normalize(
//     path.join('src', 'build-system', '__tests__'),
//   );

//   describe('VirtualDirectory', () => {
//     let virtualDir: VirtualDirectory;
//     let structMarkdownContent: string;

//     beforeEach(() => {
//       structMarkdownContent = fs.readFileSync(structMdFilePath, 'utf8');
//       virtualDir = new VirtualDirectory();
//       virtualDir.parseJsonStructure(structMarkdownContent);
//     });

//     it('should print tree structure', () => {
//       const files = virtualDir.getAllFiles();
//       Logger.log(files);
//     });

//     // change test path to your current test file
//     it('should validate existing files', () => {
//       expect(virtualDir.isValidFile('src/pages/Home/index.tsx')).toBeTruthy();
//       expect(virtualDir.isValidFile('nonexistent.ts')).toBeFalsy();
//     });

//     it('should validate existing directories', () => {
//       expect(virtualDir.isValidDirectory('src')).toBeTruthy();
//       expect(virtualDir.isValidDirectory('src/components/common')).toBeTruthy();
//       expect(virtualDir.isValidDirectory('api')).toBeFalsy();
//       expect(virtualDir.isValidDirectory('nonexistent')).toBeFalsy();
//     });

//     it('should resolve relative paths correctly', () => {
//       const resolved = virtualDir.resolveRelativePath(
//         'src/components/common/Button/index.tsx',
//         '../Loader/index.tsx',
//       );
//       expect(virtualDir.isValidFile(resolved)).toBeTruthy();
//       expect(resolved).toBe('src/components/common/Loader/index.tsx');
//     });
//   });
// });
