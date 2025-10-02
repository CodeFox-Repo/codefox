import { Controller, Delete, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { UserService } from './user.service';
import { AppConfigService } from 'src/config/config.service';
import { Logger } from '@nestjs/common';

/**
 * Test Cleanup Controller
 * This controller is only available in development/test environments
 * It provides endpoints to clean up test data
 */
@Controller('api/test')
export class TestCleanupController {
  private readonly logger = new Logger(TestCleanupController.name);

  constructor(
    private readonly userService: UserService,
    private readonly configService: AppConfigService,
  ) {}

  /**
   * Delete a user by email (only in dev/test environment)
   * This is useful for cleaning up test accounts
   */
  @Delete('user/:email')
  @HttpCode(HttpStatus.OK)
  async deleteUserByEmail(@Param('email') email: string): Promise<{
    success: boolean;
    message: string;
  }> {
    // Only allow in development or test environment
    if (this.configService.isProduction) {
      this.logger.warn(
        `Attempted to delete user in production environment: ${email}`,
      );
      return {
        success: false,
        message: 'This endpoint is only available in development/test mode',
      };
    }

    try {
      this.logger.log(`Deleting test user: ${email}`);

      // Find user by email
      const user = await this.userService.getUserByEmail(email);

      if (!user) {
        return {
          success: false,
          message: `User not found: ${email}`,
        };
      }

      // Delete the user (this should cascade delete related entities)
      await this.userService.deleteUser(user.id);

      this.logger.log(`Successfully deleted test user: ${email}`);

      return {
        success: true,
        message: `User ${email} deleted successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to delete user ${email}:`, error.stack);
      return {
        success: false,
        message: `Failed to delete user: ${error.message}`,
      };
    }
  }

  /**
   * Delete a user by ID (only in dev/test environment)
   */
  @Delete('user/id/:userId')
  @HttpCode(HttpStatus.OK)
  async deleteUserById(@Param('userId') userId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    // Only allow in development or test environment
    if (this.configService.isProduction) {
      this.logger.warn(
        `Attempted to delete user in production environment: ${userId}`,
      );
      return {
        success: false,
        message: 'This endpoint is only available in development/test mode',
      };
    }

    try {
      this.logger.log(`Deleting test user by ID: ${userId}`);

      await this.userService.deleteUser(userId);

      this.logger.log(`Successfully deleted test user: ${userId}`);

      return {
        success: true,
        message: `User ${userId} deleted successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to delete user ${userId}:`, error.stack);
      return {
        success: false,
        message: `Failed to delete user: ${error.message}`,
      };
    }
  }
}
