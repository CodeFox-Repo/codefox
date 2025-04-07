import { FC } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import ChatIcon from '@mui/icons-material/Chat';
import FolderIcon from '@mui/icons-material/Folder';
import SecurityIcon from '@mui/icons-material/Security';
import MenuIcon from '@mui/icons-material/Menu';
import { useQuery } from '@apollo/client';
import { GET_DASHBOARD_STATS } from 'src/graphql/request';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  description?: string;
}

const StatCard: FC<StatCardProps> = ({ title, value, icon, description }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Grid container spacing={3} alignItems="center">
        <Grid item>
          <Box
            sx={{
              backgroundColor: 'primary.lighter',
              borderRadius: 1,
              p: 2,
              display: 'flex'
            }}
          >
            {icon}
          </Box>
        </Grid>
        <Grid item>
          <Typography variant="h1" component="div">
            {value}
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {description}
            </Typography>
          )}
        </Grid>
      </Grid>
    </CardContent>
  </Card>
);

const DashboardOverview: FC = () => {
  const { data, loading, error } = useQuery(GET_DASHBOARD_STATS);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const stats = data.dashboardStats;
  return (
    <>
      <Box
        sx={{
          pt: 3,
          pb: 5
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <StatCard
                title="Total Users"
                value={stats.totalUsers}
                icon={<PersonIcon color="primary" />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <StatCard
                title="Total Chats"
                value={stats.totalChats}
                icon={<ChatIcon color="primary" />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <StatCard
                title="Total Projects"
                value={stats.totalProjects}
                icon={<FolderIcon color="primary" />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <StatCard
                title="User Roles"
                value={stats.totalRoles}
                icon={<SecurityIcon color="primary" />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <StatCard
                title="Menu Items"
                value={stats.totalMenus}
                icon={<MenuIcon color="primary" />}
              />
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  );
};

export default DashboardOverview;
