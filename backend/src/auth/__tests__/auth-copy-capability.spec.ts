import { AuthResolver } from '../auth.resolver';
import { AuthService } from '../auth.service';

// No password operations are under test. Avoid requiring a native bcrypt
// binary just to read a deployment-wide boolean.
jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('sqlite3', () => ({ Database: jest.fn() }));

describe('password reset email availability', () => {
  it.each([false, true])(
    'reports only the global mail flag (%s)',
    (enabled) => {
      // Exercise the real service getter and resolver without an account, mail
      // server, or database. This capability must never look up an address.
      const service = Object.create(AuthService.prototype) as AuthService;
      Object.defineProperty(service, 'isMailEnabled', { value: enabled });
      Object.defineProperty(service, 'userRepository', {
        get: () => {
          throw new Error('A global capability must not inspect any account');
        },
      });
      expect(new AuthResolver(service).passwordResetEmailAvailable()).toBe(
        enabled,
      );
    },
  );
});
