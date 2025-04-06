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
  MenuItem,
  OutlinedInput,
  Chip
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { ROLE_QUERY, CREATE_ROLE, UPDATE_ROLE } from 'src/graphql/role';
import { MENUS_QUERY } from 'src/graphql/menu';

const RoleForm: FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    menuIds: [] as string[]
  });

  const { data: menuData } = useQuery(MENUS_QUERY);
  const { data: roleData } = useQuery(ROLE_QUERY, {
    variables: { id },
    skip: !id
  });

  const [createRole] = useMutation(CREATE_ROLE);
  const [updateRole] = useMutation(UPDATE_ROLE);

  useEffect(() => {
    if (roleData?.role) {
      setFormData({
        name: roleData.role.name,
        description: roleData.role.description || '',
        menuIds: roleData.role.menus.map((menu) => menu.id)
      });
    }
  }, [roleData]);

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
        await updateRole({
          variables: {
            updateRoleInput: {
              id,
              ...formData
            }
          }
        });
      } else {
        await createRole({
          variables: {
            createRoleInput: formData
          }
        });
      }
      navigate('/management/roles');
    } catch (error) {
      console.error('Error saving role:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <Box p={3}>
          <Typography variant="h4">
            {isEdit ? 'Edit Role' : 'Create Role'}
          </Typography>
        </Box>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Name"
                name="name"
                value={formData.name}
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
              <FormControl fullWidth>
                <InputLabel>Menus</InputLabel>
                <Select
                  multiple
                  value={formData.menuIds}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      menuIds: e.target.value as string[]
                    }))
                  }
                  input={<OutlinedInput label="Menus" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((menuId) => (
                        <Chip
                          key={menuId}
                          label={
                            menuData?.menus.find((m) => m.id === menuId)?.name
                          }
                        />
                      ))}
                    </Box>
                  )}
                >
                  {menuData?.menus.map((menu) => (
                    <MenuItem key={menu.id} value={menu.id}>
                      {menu.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Box mt={3} display="flex" justifyContent="space-between">
            <Button
              variant="outlined"
              onClick={() => navigate('/management/roles')}
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

export default RoleForm;
