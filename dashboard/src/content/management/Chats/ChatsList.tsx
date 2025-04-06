import { FC, useState } from 'react';
import {
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Typography,
  Tooltip,
  Box,
  Chip
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import ChatIcon from '@mui/icons-material/Chat';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useQuery, useMutation } from '@apollo/client';
import {
  GET_DASHBOARD_CHATS,
  DELETE_DASHBOARD_CHAT
} from 'src/graphql/request';

const ChatsList: FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);

  // 查询聊天列表
  const { data, loading, error, refetch } = useQuery(GET_DASHBOARD_CHATS);

  // 删除聊天的 mutation
  const [deleteChat] = useMutation(DELETE_DASHBOARD_CHAT, {
    onCompleted: () => {
      // 删除成功后刷新列表
      refetch();
    },
    onError: (err) => {
      console.error('Delete chat error:', err);
      // 可扩展提示错误信息，比如使用 Snackbar
    }
  });

  const handlePageChange = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (event: any) => {
    setLimit(parseInt(event.target.value));
    setPage(0);
  };

  // 删除操作
  const handleDelete = async (chatId: string) => {
    if (window.confirm('Are you sure you want to delete this chat?')) {
      await deleteChat({ variables: { id: chatId } });
    }
  };

  // 从查询中获取聊天数据
  const chats = data?.dashboardChats || [];
  const paginatedChats = chats.slice(page * limit, page * limit + limit);

  return (
    <>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        p={2}
      >
        <Typography variant="h3">Chats Management</Typography>
      </Box>
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Messages</TableCell>
                <TableCell>Last Activity</TableCell>
                <TableCell>Created Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8}>Loading...</TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={8}>Error: {error.message}</TableCell>
                </TableRow>
              ) : paginatedChats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>No chats found</TableCell>
                </TableRow>
              ) : (
                paginatedChats.map((chat: any) => (
                  <TableRow hover key={chat.id}>
                    <TableCell>{chat.title}</TableCell>
                    <TableCell>
                      {chat.user ? chat.user.username : '-'}
                    </TableCell>
                    <TableCell>
                      {chat.project ? chat.project.projectName : '-'}
                    </TableCell>
                    <TableCell>
                      {typeof chat.messagesCount !== 'undefined'
                        ? chat.messagesCount
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {chat.lastActivity
                        ? format(
                            new Date(chat.lastActivity),
                            'yyyy-MM-dd HH:mm'
                          )
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {chat.createdAt
                        ? format(new Date(chat.createdAt), 'yyyy-MM-dd')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={chat.isActive ? 'Active' : 'Inactive'}
                        color={chat.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() =>
                            navigate(`/management/chats/view/${chat.id}`)
                          }
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Enter Chat">
                        <IconButton
                          size="small"
                          onClick={() =>
                            navigate(`/management/chats/chat/${chat.id}`)
                          }
                        >
                          <ChatIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(chat.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Box p={2}>
          <TablePagination
            component="div"
            count={chats.length}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={limit}
            onRowsPerPageChange={handleLimitChange}
            rowsPerPageOptions={[5, 10, 25, 30]}
          />
        </Box>
      </Card>
    </>
  );
};

export default ChatsList;
