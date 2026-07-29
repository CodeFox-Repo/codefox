import { validate } from 'class-validator';
import { RegisterUserInput } from 'src/user/dto/register-user.input';

describe('RegisterUserInput', () => {
  it('should validate valid registration input', async () => {
    // Arrange
    const registerInput = new RegisterUserInput();
    registerInput.username = 'testuser';
    registerInput.email = 'test@example.com';
    registerInput.password = 'password123';
    registerInput.confirmPassword = 'password123';

    // Act
    const errors = await validate(registerInput);

    // Assert
    expect(errors.length).toBe(0);
  });

  it('should fail validation with short username', async () => {
    // Arrange
    const registerInput = new RegisterUserInput();
    registerInput.username = 'te'; // Less than 3 characters
    registerInput.email = 'test@example.com';
    registerInput.password = 'password123';
    registerInput.confirmPassword = 'password123';

    // Act
    const errors = await validate(registerInput);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
  });

  it('should fail validation with short password', async () => {
    // Arrange
    const registerInput = new RegisterUserInput();
    registerInput.username = 'testuser';
    registerInput.email = 'test@example.com';
    registerInput.password = '12345'; // Less than 6 characters
    registerInput.confirmPassword = '12345';

    // Act
    const errors = await validate(registerInput);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('minLength');
  });

  it('should fail validation with invalid email', async () => {
    // Arrange
    const registerInput = new RegisterUserInput();
    registerInput.username = 'testuser';
    registerInput.email = 'invalid-email';
    registerInput.password = 'password123';
    registerInput.confirmPassword = 'password123';

    // Act
    const errors = await validate(registerInput);

    // Assert
    expect(errors.length).toBeGreaterThan(0);
    // By property rather than errors[0]: the order of validated fields is
    // not the DTO's contract, and asserting on it broke when a field was
    // added ahead of email.
    const email = errors.find((error) => error.property === 'email');
    expect(email?.constraints).toHaveProperty('isEmail');
  });
});
