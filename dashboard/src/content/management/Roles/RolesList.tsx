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
  Button,
  IconButton,
  Typography,
  Tooltip,
  Box
} from '@mui/material';
import { useQuery, useMutation } from '@apollo/client';
import { ROLES_QUERY, DELETE_ROLE } from 'src/graphql/role';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import DeleteTwoToneIcon from '@mui/icons-material/DeleteTwoTone';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import { useNavigate } from 'react-router-dom';

const RolesList: FC = () => {
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const navigate = useNavigate();

  const { data, loading, refetch } = useQuery(ROLES_QUERY);
  const [deleteRole] = useMutation(DELETE_ROLE);

  const handlePageChange = (event: unknown, newPage: number): void => {
    setPage(newPage);
  };

  const handleLimitChange = (event: any): void => {
    setLimit(parseInt(event.target.value));
  };

  const handleDeleteRole = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this role?')) {
      await deleteRole({ variables: { id } });
      refetch();
    }
  };

  const handleEditRole = (id: string) => {
    navigate(`/management/roles/edit/${id}`);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <Box p={2} display="flex" justifyContent="space-between">
        <Typography variant="h4">Roles</Typography>
        <Button
          variant="contained"
          startIcon={<AddTwoToneIcon />}
          onClick={() => navigate('/management/roles/create')}
        >
          Create Role
        </Button>
      </Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Menus</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.roles.slice(page * limit, (page + 1) * limit).map((role) => (
              <TableRow key={role.id}>
                <TableCell>{role.name}</TableCell>
                <TableCell>{role.description}</TableCell>
                <TableCell>
                  {role.menus?.map((menu) => menu.name).join(', ')}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit Role" arrow>
                    <IconButton
                      onClick={() => handleEditRole(role.id)}
                      color="primary"
                    >
                      <EditTwoToneIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Role" arrow>
                    <IconButton
                      onClick={() => handleDeleteRole(role.id)}
                      color="error"
                    >
                      <DeleteTwoToneIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={data?.roles.length || 0}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleLimitChange}
        page={page}
        rowsPerPage={limit}
        rowsPerPageOptions={[5, 10, 25, 30]}
      />
    </Card>
  );
};

export default RolesList;
