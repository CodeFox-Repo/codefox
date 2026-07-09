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
  Chip
} from '@mui/material';
import { GET_DASHBOARD_CHAT } from 'src/graphql/request';

const ChatView: FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, loading, error } = useQuery(GET_DASHBOARD_CHAT, {
    variables: { id }
  });

  if (loading) {
    return (
      <Box p={3}>
        <Typography>Loading chat details...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Typography color="error">Error loading chat details</Typography>
      </Box>
    );
  }

  const chat = data?.dashboardChat;

  return (
    <Card>
      <Box p={3}>
        <Typography variant="h4">Chat Details</Typography>
      </Box>
      <CardContent>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold">
              Title
            </Typography>
            <Typography>{chat?.title}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold">
              Status
            </Typography>
            <Chip
              label={chat?.isActive ? 'Active' : 'Inactive'}
              color={chat?.isActive ? 'success' : 'default'}
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold">
              User
            </Typography>
            <Typography>{chat?.user?.username}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold">
              Project
            </Typography>
            <Typography>{chat?.project?.projectName}</Typography>
          </Grid>
        </Grid>
        <Box mt={3}>
          <Button
            variant="outlined"
            onClick={() => navigate('/management/chats')}
          >
            Back to Chats
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ChatView;
