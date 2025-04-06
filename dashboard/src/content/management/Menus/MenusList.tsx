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
import { MENUS_QUERY, DELETE_MENU } from 'src/graphql/menu';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import DeleteTwoToneIcon from '@mui/icons-material/DeleteTwoTone';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import { useNavigate } from 'react-router-dom';

const MenusList: FC = () => {
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const navigate = useNavigate();

  const { data, loading, refetch } = useQuery(MENUS_QUERY);
  const [deleteMenu] = useMutation(DELETE_MENU);

  const handlePageChange = (event: unknown, newPage: number): void => {
    setPage(newPage);
  };

  const handleLimitChange = (event: any): void => {
    setLimit(parseInt(event.target.value));
  };

  const handleDeleteMenu = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this menu?')) {
      await deleteMenu({ variables: { id } });
      refetch();
    }
  };

  const handleEditMenu = (id: string) => {
    navigate(`/management/menus/edit/${id}`);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <Box p={2} display="flex" justifyContent="space-between">
        <Typography variant="h4">Menus</Typography>
        <Button
          variant="contained"
          startIcon={<AddTwoToneIcon />}
          onClick={() => navigate('/management/menus/create')}
        >
          Create Menu
        </Button>
      </Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Path</TableCell>
              <TableCell>Permission</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.menus.slice(page * limit, (page + 1) * limit).map((menu) => (
              <TableRow key={menu.id}>
                <TableCell>{menu.name}</TableCell>
                <TableCell>{menu.path}</TableCell>
                <TableCell>{menu.permission}</TableCell>
                <TableCell>
                  {menu.roles?.map((role) => role.name).join(', ')}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit Menu" arrow>
                    <IconButton
                      onClick={() => handleEditMenu(menu.id)}
                      color="primary"
                    >
                      <EditTwoToneIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Menu" arrow>
                    <IconButton
                      onClick={() => handleDeleteMenu(menu.id)}
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
        count={data?.menus.length || 0}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleLimitChange}
        page={page}
        rowsPerPage={limit}
        rowsPerPageOptions={[5, 10, 25, 30]}
      />
    </Card>
  );
};

export default MenusList;
