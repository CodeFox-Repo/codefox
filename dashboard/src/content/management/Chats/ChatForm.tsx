import { FC, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Box,
  Button,
  Grid,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import {
  GET_DASHBOARD_CHAT,
  CREATE_DASHBOARD_CHAT,
  UPDATE_DASHBOARD_CHAT,
  GET_DASHBOARD_PROJECTS
} from 'src/graphql/request';

const ChatForm: FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    title: '',
    projectId: '',
    isActive: true
  });

  const { data: chatData } = useQuery(GET_DASHBOARD_CHAT, {
    variables: { id },
    skip: !id
  });

  const { data: projectsData } = useQuery(GET_DASHBOARD_PROJECTS);

  const [createChat] = useMutation(CREATE_DASHBOARD_CHAT);
  const [updateChat] = useMutation(UPDATE_DASHBOARD_CHAT);

  useEffect(() => {
    if (chatData?.dashboardChat) {
      setFormData({
        title: chatData.dashboardChat.title,
        projectId: chatData.dashboardChat.project?.id || '',
        isActive: chatData.dashboardChat.isActive
      });
    }
  }, [chatData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await updateChat({
          variables: {
            id,
            input: formData
          }
        });
      } else {
        await createChat({
          variables: {
            input: formData
          }
        });
      }
      navigate('/management/chats');
    } catch (error) {
      console.error('Error saving chat:', error);
    }
  };

  const projects = projectsData?.dashboardProjects || [];

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <Box p={3}>
          <Typography variant="h4">
            {isEdit ? 'Edit Chat' : 'Create Chat'}
          </Typography>
        </Box>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Title"
                name="title"
                value={formData.title}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Project</InputLabel>
                <Select
                  value={formData.projectId}
                  label="Project"
                  name="projectId"
                  onChange={handleChange}
                >
                  {projects.map((project) => (
                    <MenuItem key={project.id} value={project.id}>
                      {project.projectName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Box mt={3} display="flex" justifyContent="space-between">
            <Button
              variant="outlined"
              onClick={() => navigate('/management/chats')}
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

export default ChatForm;
