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
            <Grid item xs={12}>
              <Box pb={3}>
                <Typography variant="h3">Dashboard Overview</Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <StatCard
                title="Total Users"
                value="0"
                icon={<PersonIcon color="primary" />}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <StatCard
                title="Total Chats"
                value="0"
                icon={<ChatIcon color="primary" />}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <StatCard
                title="Total Projects"
                value="0"
                icon={<FolderIcon color="primary" />}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <StatCard
                title="User Roles"
                value="0"
                icon={<SecurityIcon color="primary" />}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <StatCard
                title="Menu Items"
                value="0"
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
