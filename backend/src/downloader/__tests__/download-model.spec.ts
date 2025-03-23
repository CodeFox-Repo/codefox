// import { isIntegrationTest } from 'src/common/utils';
// import {
//   ConfigLoader,
//   ModelConfig,
//   EmbeddingConfig,
// } from '../../config/config-loader';
// import { UniversalDownloader } from '../model-downloader';
// import { ConfigType, downloadAll, TaskType } from '../universal-utils';

// const originalIsArray = Array.isArray;

// Array.isArray = jest.fn((type: any): type is any[] => {
//   if (
//     type &&
//     type.constructor &&
//     (type.constructor.name === 'Float32Array' ||
//       type.constructor.name === 'BigInt64Array')
//   ) {
//     return true;
//   }
//   return originalIsArray(type);
// }) as unknown as (arg: any) => arg is any[];

// (isIntegrationTest ? describe : describe.skip)(
//   'loadAllChatsModels with real model loading',
//   () => {
//     let modelConfigLoader: ConfigLoader;
//     let embConfigLoader: ConfigLoader;
//     beforeAll(async () => {
//       modelConfigLoader = ConfigLoader.getInstance(ConfigType.CHATS);
//       embConfigLoader = ConfigLoader.getInstance(ConfigType.EMBEDDINGS);
//       const modelConfig: ModelConfig = {
//         model: 'Xenova/flan-t5-small',
//         endpoint: 'http://localhost:11434/v1',
//         token: 'your-token-here',
//         task: 'text2text-generation',
//       };
//       modelConfigLoader.addConfig(modelConfig);

//       const embConfig: EmbeddingConfig = {
//         model: 'fast-bge-base-en-v1.5',
//         endpoint: 'http://localhost:11434/v1',
//         token: 'your-token-here',
//       };
//       embConfigLoader.addConfig(embConfig);
//       await downloadAll();
//     }, 60000000);

//     it('should load real models specified in config', async () => {
//       const downloader = UniversalDownloader.getInstance();
//       const chat1Model = await downloader.getLocalModel(
//         TaskType.CHAT,
//         'Xenova/flan-t5-small',
//       );
//       expect(chat1Model).toBeDefined();

//       expect(chat1Model).toHaveProperty('model');
//       expect(chat1Model).toHaveProperty('tokenizer');

//       try {
//         const chat1Output = await chat1Model(
//           'Write me a love poem about cheese.',
//           {
//             max_new_tokens: 200,
//             temperature: 0.9,
//             repetition_penalty: 2.0,
//             no_repeat_ngram_size: 3,
//           },
//         );

//         expect(chat1Output).toBeDefined();
//         expect(chat1Output[0]).toHaveProperty('generated_text');
//       } catch (error) {
//         //
//       }
//     }, 6000000);
//   },
// );

// afterAll(() => {
//   Array.isArray = originalIsArray;
// });
