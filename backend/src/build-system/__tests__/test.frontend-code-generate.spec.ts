import { MockBuilderContext } from './mock/MockBuilderContext';
import { FrontendCodeHandler } from '../handlers/frontend-code-generate';
import { BuildSequence } from '../types';

describe('FrontendCodeHandler', () => {
  let handler: FrontendCodeHandler;
  let context: MockBuilderContext;

  const sequence: BuildSequence = {
    id: 'test-backend-sequence',
    version: '1.0.0',
    name: 'Spotify-like Music Web',
    description: 'Users can play music',
    databaseType: 'SQLite',
    model: 'o4-mini',
    nodes: [
      {
        handler: FrontendCodeHandler,
        name: 'Frontend Code Handler',
        // requires: ['op:FILE:STRUCT', 'op:UX:DATAMAP:DOC'],
      },
    ],
    packages: [],
  };

  beforeEach(() => {
    handler = new FrontendCodeHandler();
    context = new MockBuilderContext(sequence, 'frontend-only');
  });

  //rember to comment requirement in FrontendCodeHandler

  it('should generate frontend code successfully', async () => {
    const result = await handler.run(context);

    expect(result.success).toBe(true);
  }, 6000000);
});
