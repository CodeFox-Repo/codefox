import { MessageRole } from '../message.model';
import { normaliseRole } from '../chat.service';

/**
 * A chat whose messages column holds a role outside the enum cannot be read
 * back at all: `getChatHistory` throws `Enum "Role" cannot represent value`,
 * and the UI turns that into "This project could not be opened" — on a
 * project the user owns, permanently, with no way back through the product.
 *
 * `ChatInputType.role` is a plain GraphQL String (typing it as the enum flips
 * the accepted spelling and breaks every client), so this function is the only
 * thing standing between a caller's typo and a bricked conversation.
 */
describe('normaliseRole', () => {
  it('passes the spellings clients actually send', () => {
    expect(normaliseRole('user')).toBe(MessageRole.User);
    expect(normaliseRole('assistant')).toBe(MessageRole.Assistant);
    expect(normaliseRole('system')).toBe(MessageRole.System);
  });

  it('folds the case that bricked a chat', () => {
    // "Assistant" is the GraphQL enum's NAME, and reaching for it instead of
    // its value is the mistake that actually happened.
    expect(normaliseRole('Assistant')).toBe(MessageRole.Assistant);
    expect(normaliseRole('USER')).toBe(MessageRole.User);
  });

  it('refuses a role it cannot map, rather than guessing', () => {
    // Silently relabelling would put a wrong-but-readable role in history.
    expect(() => normaliseRole('bot')).toThrow(/Unknown message role/);
    expect(() => normaliseRole('')).toThrow(/Unknown message role/);
  });

  it('returns a value the enum can represent, whatever came in', () => {
    // The property that matters: whatever this returns must survive the read
    // path, which validates against the enum's values.
    const values = Object.values(MessageRole);
    for (const input of ['user', 'User', 'ASSISTANT', 'system']) {
      expect(values).toContain(normaliseRole(input));
    }
  });
});
