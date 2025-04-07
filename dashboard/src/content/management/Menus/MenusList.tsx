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
  Chip,
  Button
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useQuery, useMutation } from '@apollo/client';
import { MENUS_QUERY, DELETE_MENU, UPDATE_MENU } from 'src/graphql/request';

const MenusList: FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);

  // 查询菜单列表
  const { data, loading, error, refetch } = useQuery(MENUS_QUERY);

  // 删除菜单 Mutation
  const [deleteMenu] = useMutation(DELETE_MENU, {
    onCompleted: () => {
      refetch();
    },
    onError: (err) => {
      console.error('Delete menu error:', err);
    }
  });

  // 更新菜单状态 Mutation
  const [updateMenu] = useMutation(UPDATE_MENU, {
    onCompleted: () => {
      refetch();
    },
    onError: (err) => {
      console.error('Update menu error:', err);
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
  const handleDelete = async (menuId: string) => {
    if (window.confirm('Are you sure you want to delete this menu?')) {
      await deleteMenu({ variables: { id: menuId } });
    }
  };

  // 锁定/解锁操作：调用 updateMenu 传入更新后的 isActive 值（取反当前状态）
  const handleToggleStatus = async (menuId: string, currentStatus: boolean) => {
    await updateMenu({
      variables: { updateMenuInput: { id: menuId, isActive: !currentStatus } }
    });
  };

  // 获取查询数据
  const menus = data?.menus || [];
  const paginatedMenus = menus.slice(page * limit, page * limit + limit);

  return (
    <>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        p={2}
      >
        <Typography variant="h3">Menus Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/management/menus/create')}
        >
          Create Menu
        </Button>
      </Box>
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Menu Name</TableCell>
                <TableCell>Path</TableCell>
                <TableCell>Permission</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Roles</TableCell>
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
              ) : paginatedMenus.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>No menus found</TableCell>
                </TableRow>
              ) : (
                paginatedMenus.map((menu: any) => (
                  <TableRow hover key={menu.id}>
                    <TableCell>{menu.name}</TableCell>
                    <TableCell>{menu.path}</TableCell>
                    <TableCell>{menu.permission || '-'}</TableCell>
                    <TableCell>{menu.description || '-'}</TableCell>
                    <TableCell>
                      {menu.roles && menu.roles.length > 0
                        ? menu.roles.map((role: any) => role.name).join(', ')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {menu.createdAt
                        ? format(new Date(menu.createdAt), 'yyyy-MM-dd')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={menu.isActive ? 'Active' : 'Inactive'}
                        color={menu.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Lock/Unlock">
                        <IconButton
                          size="small"
                          onClick={() =>
                            handleToggleStatus(menu.id, menu.isActive)
                          }
                        >
                          {menu.isActive ? (
                            <LockIcon fontSize="small" />
                          ) : (
                            <LockOpenIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() =>
                            navigate(`/management/menus/edit/${menu.id}`)
                          }
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(menu.id)}
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
            count={menus.length}
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

export default MenusList;
