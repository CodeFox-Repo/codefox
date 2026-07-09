import { FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Grid,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { GET_DASHBOARD_PROJECT } from 'src/graphql/request';

const ProjectView: FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, loading, error } = useQuery(GET_DASHBOARD_PROJECT, {
    variables: { id }
  });

  if (loading) {
    return (
      <Box p={3}>
        <Typography>Loading project details...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Typography color="error">Error loading project details</Typography>
      </Box>
    );
  }

  const project = data?.dashboardProject;

  return (
    <Card>
      <Box p={3}>
        <Typography variant="h4">Project Details</Typography>
      </Box>
      <CardContent>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold">
              Project Name
            </Typography>
            <Typography>{project?.projectName}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold">
              Description
            </Typography>
            <Typography>
              {project?.description || 'No description provided'}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold">
              Owner
            </Typography>
            <Typography>{project?.user?.username}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold">
              Project Packages
            </Typography>
            {project?.projectPackages?.length > 0 ? (
              <List>
                {project.projectPackages.map((pkg) => (
                  <ListItem key={pkg.id}>
                    <ListItemText primary={pkg.name} />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="textSecondary">No packages added</Typography>
            )}
          </Grid>
        </Grid>
        <Box mt={3}>
          <Button
            variant="outlined"
            onClick={() => navigate('/management/projects')}
          >
            Back to Projects
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ProjectView;
