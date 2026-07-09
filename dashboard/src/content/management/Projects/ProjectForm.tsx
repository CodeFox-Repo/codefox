import React, { FC, useEffect, useState, useCallback } from 'react';
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
import { useMutation, useQuery, useLazyQuery } from '@apollo/client';
import {
  GET_DASHBOARD_PROJECT,
  CREATE_DASHBOARD_PROJECT,
  UPDATE_DASHBOARD_PROJECT,
  GET_CHAT_DETAILS
} from 'src/graphql/request';
import { toast } from 'sonner';

const ProjectForm: FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    projectName: '',
    description: '',
    public: false
  });

  // 获取项目详情（编辑时使用）
  const { data: projectData } = useQuery(GET_DASHBOARD_PROJECT, {
    variables: { id },
    skip: !id
  });

  // 创建和更新项目 Mutation
  const [createProject] = useMutation(CREATE_DASHBOARD_PROJECT);
  const [updateProject] = useMutation(UPDATE_DASHBOARD_PROJECT);
  // 用于轮询获取 chat 详情的 lazyQuery
  const [getChatDetail] = useLazyQuery(GET_CHAT_DETAILS);

  useEffect(() => {
    if (projectData?.dashboardProject) {
      setFormData({
        projectName: projectData.dashboardProject.projectName,
        description: projectData.dashboardProject.description || '',
        public: projectData.dashboardProject.isPublic || false
      });
    }
  }, [projectData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, value, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // 轮询函数：每 3 秒请求一次，最多重试 10 次，根据 chatId 查询 chat 详情
  const pollChatProject = useCallback(
    async (chatId: string): Promise<any | null> => {
      const maxRetries = 10;
      let retries = 0;
      while (retries < maxRetries) {
        try {
          const { data } = await getChatDetail({ variables: { chatId } });
          // 假设返回数据结构为 data.getChatDetails.chat，表示 chat 已生成
          if (data?.getChatDetails?.chat) {
            return data.getChatDetails;
          }
        } catch (error) {
          console.error(`Polling attempt ${retries + 1} failed:`, error);
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
        retries++;
      }
      return null;
    },
    [getChatDetail]
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await updateProject({
          variables: {
            id,
            input: formData
          }
        });
        navigate('/management/projects');
      } else {
        // 调用创建项目的 Mutation
        const result = await createProject({
          variables: {
            input: formData
          }
        });
        const chatId = result.data?.createDashboardProject?.id;
        if (chatId) {
          // 轮询获取 chat 详情
          pollChatProject(chatId);
          navigate('/management/projects');
        }
      }
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('Error saving project. Please try again.');
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
                    checked={formData.public}
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
