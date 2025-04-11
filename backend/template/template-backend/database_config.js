import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { logger } from './logger';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '../database.sqlite');

export const initializeDatabase = async () => {
  try {
    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    logger.info(dbDir);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Open the database
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Enable foreign keys
    await db.exec('PRAGMA foreign_keys = ON');

    logger.info('Database initialized successfully');
    return db;
  } catch (error) {
    logger.error('Database initialization failed', error);
    throw error;
  }
};
