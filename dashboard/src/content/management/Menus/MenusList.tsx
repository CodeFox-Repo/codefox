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
import { useQuery } from '@apollo/client';
import { MENUS_QUERY } from 'src/graphql/request';

const MenusList: FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);

  const { data, loading, error } = useQuery(MENUS_QUERY);

  const handlePageChange = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (event: any) => {
    setLimit(parseInt(event.target.value));
    setPage(0);
  };

  console.log('Data:', data);
  const menus = data?.menus || [];
  console.log('Menus:', menus);
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
                          onClick={() => {
                            /* 锁定/解锁操作 */
                          }}
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
                          onClick={() => {
                            /* 删除操作 */
                          }}
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
