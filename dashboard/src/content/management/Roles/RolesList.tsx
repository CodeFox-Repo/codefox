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
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useQuery } from '@apollo/client';
import { GET_DASHBOARD_ROLES } from 'src/graphql/request';

const RolesList: FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);

  const { data, loading, error } = useQuery(GET_DASHBOARD_ROLES);

  const handlePageChange = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (event: any) => {
    setLimit(parseInt(event.target.value));
    setPage(0);
  };

  const roles = data?.dashboardRoles || [];
  const paginatedRoles = roles.slice(page * limit, page * limit + limit);

  return (
    <>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        p={2}
      >
        <Typography variant="h3">Roles Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/management/roles/create')}
        >
          Create Role
        </Button>
      </Box>
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Role Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Menus Count</TableCell>
                <TableCell>Users Count</TableCell>
                <TableCell>Created Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7}>Loading...</TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7}>Error: {error.message}</TableCell>
                </TableRow>
              ) : paginatedRoles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>No roles found</TableCell>
                </TableRow>
              ) : (
                paginatedRoles.map((role) => (
                  <TableRow hover key={role.id}>
                    <TableCell>{role.name}</TableCell>
                    <TableCell>{role.description || '-'}</TableCell>
                    <TableCell>{role.menus?.length ?? 0}</TableCell>
                    <TableCell>{role.users?.length ?? 0}</TableCell>
                    <TableCell>
                      {format(new Date(role.createdAt), 'yyyy-MM-dd')}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={role.isActive ? 'Active' : 'Inactive'}
                        color={role.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Menus">
                        <IconButton size="small">
                          <MenuBookIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() =>
                            navigate(`/management/roles/edit/${role.id}`)
                          }
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error">
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
            count={roles.length}
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

export default RolesList;
