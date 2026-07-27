import { SetMetadata } from '@nestjs/common';

export const MENU_PATH_KEY = 'menuPath';
export const Menu = (path: string) => SetMetadata(MENU_PATH_KEY, path);
