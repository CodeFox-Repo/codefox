import { Suspense, lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { RouteObject } from 'react-router';

import SidebarLayout from 'src/layouts/SidebarLayout';
import BaseLayout from 'src/layouts/BaseLayout';

import SuspenseLoader from 'src/components/SuspenseLoader';

const Loader = (Component) => (props) =>
  (
    <Suspense fallback={<SuspenseLoader />}>
      <Component {...props} />
    </Suspense>
  );

// Dashboard
const DashboardOverview = Loader(
  lazy(() => import('src/content/dashboard/Overview/DashboardOverview'))
);

// Management
const UsersList = Loader(
  lazy(() => import('src/content/management/Users/UsersList'))
);
const UserCreate = Loader(
  lazy(() => import('src/content/management/Users/UserCreate'))
);
const UserEdit = Loader(
  lazy(() => import('src/content/management/Users/UserEdit'))
);

const RolesList = Loader(
  lazy(() => import('src/content/management/Roles/RolesList'))
);
const RoleCreate = Loader(
  lazy(() => import('src/content/management/Roles/RoleCreate'))
);
const RoleEdit = Loader(
  lazy(() => import('src/content/management/Roles/RoleEdit'))
);

const MenusList = Loader(
  lazy(() => import('src/content/management/Menus/MenusList'))
);
const MenuCreate = Loader(
  lazy(() => import('src/content/management/Menus/MenuCreate'))
);
const MenuEdit = Loader(
  lazy(() => import('src/content/management/Menus/MenuEdit'))
);

const ChatsList = Loader(
  lazy(() => import('src/content/management/Chats/ChatsList'))
);
const ChatView = Loader(
  lazy(() => import('src/content/management/Chats/ChatView'))
);

const ProjectsList = Loader(
  lazy(() => import('src/content/management/Projects/ProjectsList'))
);
const ProjectView = Loader(
  lazy(() => import('src/content/management/Projects/ProjectView'))
);

// Status
const Status404 = Loader(
  lazy(() => import('src/content/pages/Status/Status404'))
);

const routes: RouteObject[] = [
  {
    path: '',
    element: <BaseLayout />,
    children: [
      {
        path: '/',
        element: <Navigate to="/dashboard/overview" replace />
      },
      {
        path: '*',
        element: <Status404 />
      }
    ]
  },
  {
    path: 'dashboard',
    element: <SidebarLayout />,
    children: [
      {
        path: '',
        element: <Navigate to="overview" replace />
      },
      {
        path: 'overview',
        element: <DashboardOverview />
      }
    ]
  },
  {
    path: 'management',
    element: <SidebarLayout />,
    children: [
      {
        path: '',
        element: <Navigate to="users" replace />
      },
      {
        path: 'users',
        children: [
          {
            path: '',
            element: <UsersList />
          },
          {
            path: 'create',
            element: <UserCreate />
          },
          {
            path: 'edit/:id',
            element: <UserEdit />
          }
        ]
      },
      {
        path: 'roles',
        children: [
          {
            path: '',
            element: <RolesList />
          },
          {
            path: 'create',
            element: <RoleCreate />
          },
          {
            path: 'edit/:id',
            element: <RoleEdit />
          }
        ]
      },
      {
        path: 'menus',
        children: [
          {
            path: '',
            element: <MenusList />
          },
          {
            path: 'create',
            element: <MenuCreate />
          },
          {
            path: 'edit/:id',
            element: <MenuEdit />
          }
        ]
      },
      {
        path: 'chats',
        children: [
          {
            path: '',
            element: <ChatsList />
          },
          {
            path: 'view/:id',
            element: <ChatView />
          }
        ]
      },
      {
        path: 'projects',
        children: [
          {
            path: '',
            element: <ProjectsList />
          },
          {
            path: 'view/:id',
            element: <ProjectView />
          }
        ]
      }
    ]
  }
];

export default routes;
