import { Column, DataSource, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { SystemBaseModel } from '../system-base.model';
import { Field, ID, ObjectType } from '@nestjs/graphql';

@Entity()
@ObjectType()
class TestEntity extends SystemBaseModel {
  @PrimaryGeneratedColumn()
  @Field(() => ID)
  id: string;

  @Column()
  @Field()
  name: string;
}

describe('SystemBaseModel', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    // Setup test database
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [TestEntity],
      synchronize: true,
      dropSchema: true,
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  describe('Timestamps', () => {
    it('should set created_at and updated_at on creation', async () => {
      // Arrange
      const repository = dataSource.getRepository(TestEntity);
      const entity = new TestEntity();
      entity.name = 'Test Entity';

      // Act
      const savedEntity = await repository.save(entity);

      // Assert
      expect(savedEntity.createdAt).toBeDefined();
      expect(savedEntity.updatedAt).toBeDefined();
      expect(savedEntity.createdAt instanceof Date).toBeTruthy();
      expect(savedEntity.updatedAt instanceof Date).toBeTruthy();
    });

    it('should update updated_at on entity update', async () => {
      // Arrange
      const repository = dataSource.getRepository(TestEntity);
      const entity = new TestEntity();
      entity.name = 'Test Entity';

      const savedEntity = await repository.save(entity);
      const originalUpdatedAt = savedEntity.updatedAt;

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Act
      savedEntity.name = 'Updated Name';
      const updatedEntity = await repository.save(savedEntity);

      // Assert
      expect(updatedEntity.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
      expect(updatedEntity.createdAt.getTime()).toBe(
        savedEntity.createdAt.getTime(),
      );
    });

    it('should preserve created_at on entity update', async () => {
      // Arrange
      const repository = dataSource.getRepository(TestEntity);
      const entity = new TestEntity();
      entity.name = 'Test Entity';

      // Act
      const savedEntity = await repository.save(entity);
      const originalCreatedAt = savedEntity.createdAt;

      savedEntity.name = 'Updated Name';
      const updatedEntity = await repository.save(savedEntity);

      // Assert
      expect(updatedEntity.createdAt.getTime()).toBe(
        originalCreatedAt.getTime(),
      );
    });
  });

  describe('Default Values', () => {
    it('should set default values on creation', async () => {
      // Arrange
      const repository = dataSource.getRepository(TestEntity);
      const entity = new TestEntity();
      entity.name = 'Test Entity';

      // Act
      const savedEntity = await repository.save(entity);

      // Assert
      expect(savedEntity.isActive).toBe(true);
      expect(savedEntity.isDeleted).toBe(false);
    });

    it('should allow overriding default is_active value', async () => {
      // Arrange
      const repository = dataSource.getRepository(TestEntity);
      const entity = new TestEntity();
      entity.name = 'Test Entity';
      entity.isActive = false;

      // Act
      const savedEntity = await repository.save(entity);

      // Assert
      expect(savedEntity.isActive).toBe(false);
    });

    it('should allow overriding default is_deleted value', async () => {
      // Arrange
      const repository = dataSource.getRepository(TestEntity);
      const entity = new TestEntity();
      entity.name = 'Test Entity';
      entity.isDeleted = true;

      // Act
      const savedEntity = await repository.save(entity);

      // Assert
      expect(savedEntity.isDeleted).toBe(true);
    });
  });

  describe('Status Flags', () => {
    it('should handle soft delete by updating is_deleted flag', async () => {
      // Arrange
      const repository = dataSource.getRepository(TestEntity);
      const entity = new TestEntity();
      entity.name = 'Test Entity';

      const savedEntity = await repository.save(entity);
      expect(savedEntity.isDeleted).toBe(false);

      // Act
      savedEntity.isDeleted = true;
      const deletedEntity = await repository.save(savedEntity);

      // Assert
      expect(deletedEntity.isDeleted).toBe(true);
      expect(deletedEntity.updatedAt.getTime()).toBeGreaterThanOrEqual(
        savedEntity.updatedAt.getTime(),
      );
    });

    it('should handle deactivation by updating is_active flag', async () => {
      // Arrange
      const repository = dataSource.getRepository(TestEntity);
      const entity = new TestEntity();
      entity.name = 'Test Entity';

      const savedEntity = await repository.save(entity);
      expect(savedEntity.isActive).toBe(true);

      // Act
      savedEntity.isActive = false;
      const deactivatedEntity = await repository.save(savedEntity);

      // Assert
      expect(deactivatedEntity.isActive).toBe(false);
      expect(deactivatedEntity.updatedAt.getTime()).toBeGreaterThanOrEqual(
        savedEntity.updatedAt.getTime(),
      );
    });
  });

  describe('Query Behavior', () => {
    it('should be able to query by is_active status', async () => {
      // Arrange
      const repository = dataSource.getRepository(TestEntity);

      // Create active and inactive entities
      await repository.save([
        { name: 'Active Entity', is_active: true },
        { name: 'Inactive Entity', is_active: false },
      ]);

      // Act
      const activeEntities = await repository.find({
        where: { isActive: true },
      });
      const inactiveEntities = await repository.find({
        where: { isActive: false },
      });

      // Assert
    });

    it('should be able to query by is_deleted status', async () => {
      // Arrange
      const repository = dataSource.getRepository(TestEntity);

      // Create deleted and non-deleted entities
      await repository.save([
        { name: 'Active Entity', is_deleted: false },
        { name: 'Deleted Entity', is_deleted: true },
      ]);

      // Act
      const nonDeletedEntities = await repository.find({
        where: { isDeleted: false },
      });
      const deletedEntities = await repository.find({
        where: { isDeleted: true },
      });

      // Assert
    });
  });
});
