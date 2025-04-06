import { ReactNode } from 'react';

// Icons
import DashboardTwoToneIcon from '@mui/icons-material/DashboardTwoTone';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import GroupIcon from '@mui/icons-material/Group';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import MenuIcon from '@mui/icons-material/Menu';
import SecurityIcon from '@mui/icons-material/Security';

export interface MenuItem {
  link?: string;
  icon?: ReactNode;
  badge?: string;
  items?: MenuItem[];
  name: string;
}

export interface MenuItems {
  items: MenuItem[];
  heading: string;
}

const menuItems: MenuItems[] = [
  {
    heading: 'Dashboard',
    items: [
      {
        name: 'Overview',
        icon: DashboardTwoToneIcon,
        link: '/dashboard/overview'
      }
    ]
  },
  {
    heading: 'Management',
    items: [
      {
        name: 'Users',
        icon: GroupIcon,
        link: '/management/users'
      },
      {
        name: 'Roles',
        icon: SecurityIcon,
        link: '/management/roles'
      },
      {
        name: 'Menus',
        icon: MenuIcon,
        link: '/management/menus'
      },
      {
        name: 'Chats',
        icon: ChatBubbleOutlineIcon,
        link: '/management/chats'
      },
      {
        name: 'Projects',
        icon: FolderOpenIcon,
        link: '/management/projects'
      }
    ]
  },
  {
    heading: 'Settings',
    items: [
      {
        name: 'Admin Settings',
        icon: AdminPanelSettingsIcon,
        link: '/management/settings'
      }
    ]
  }
];

export default menuItems;
