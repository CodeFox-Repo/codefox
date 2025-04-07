import { FC, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Box,
  Button,
  Grid,
  TextField,
  Typography,
  FormControlLabel,
  Switch
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import {
  GET_DASHBOARD_PROJECT,
  CREATE_DASHBOARD_PROJECT,
  UPDATE_DASHBOARD_PROJECT
} from 'src/graphql/request';

const ProjectForm: FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    projectName: '',
    description: '',
    public: false
  });

  const { data: projectData } = useQuery(GET_DASHBOARD_PROJECT, {
    variables: { id },
    skip: !id
  });

  const [createProject] = useMutation(CREATE_DASHBOARD_PROJECT);
  const [updateProject] = useMutation(UPDATE_DASHBOARD_PROJECT);

  useEffect(() => {
    if (projectData?.dashboardProject) {
      setFormData({
        projectName: projectData.dashboardProject.projectName,
        description: projectData.dashboardProject.description || '',
        isPublic: projectData.dashboardProject.isPublic || false,
        isActive: projectData.dashboardProject.isActive || true
      });
    }
  }, [projectData]);

  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value !== undefined ? value : checked
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await updateProject({
          variables: {
            id,
            input: formData
          }
        });
      } else {
        await createProject({
          variables: {
            input: formData
          }
        });
      }
      navigate('/management/projects');
    } catch (error) {
      console.error('Error saving project:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <Box p={3}>
          <Typography variant="h4">
            {isEdit ? 'Edit Project' : 'Create Project'}
          </Typography>
        </Box>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Project Name"
                name="projectName"
                value={formData.projectName}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isPublic}
                    onChange={handleChange}
                    name="isPublic"
                  />
                }
                label="Public Project"
              />
            </Grid>
          </Grid>
          <Box mt={3} display="flex" justifyContent="space-between">
            <Button
              variant="outlined"
              onClick={() => navigate('/management/projects')}
            >
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary">
              {isEdit ? 'Update' : 'Create'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </form>
  );
};

export default ProjectForm;
