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
import { MENU_QUERY, CREATE_MENU, UPDATE_MENU } from 'src/graphql/menu';
import { ROLES_QUERY } from 'src/graphql/role';

const MenuForm: FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    name: '',
    path: '',
    permission: '',
    roleIds: [] as string[]
  });

  const { data: rolesData } = useQuery(ROLES_QUERY);
  const { data: menuData } = useQuery(MENU_QUERY, {
    variables: { id },
    skip: !id
  });

  const [createMenu] = useMutation(CREATE_MENU);
  const [updateMenu] = useMutation(UPDATE_MENU);

  useEffect(() => {
    if (menuData?.menu) {
      setFormData({
        name: menuData.menu.name,
        path: menuData.menu.path,
        permission: menuData.menu.permission,
        roleIds: menuData.menu.roles.map((role) => role.id)
      });
    }
  }, [menuData]);

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
        await updateMenu({
          variables: {
            updateMenuInput: {
              id,
              ...formData
            }
          }
        });
      } else {
        await createMenu({
          variables: {
            createMenuInput: formData
          }
        });
      }
      navigate('/management/menus');
    } catch (error) {
      console.error('Error saving menu:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <Box p={3}>
          <Typography variant="h4">
            {isEdit ? 'Edit Menu' : 'Create Menu'}
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
                required
                fullWidth
                label="Path"
                name="path"
                value={formData.path}
                onChange={handleChange}
                placeholder="/example/path"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Permission"
                name="permission"
                value={formData.permission}
                onChange={handleChange}
                placeholder="example.permission"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Roles</InputLabel>
                <Select
                  multiple
                  value={formData.roleIds}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      roleIds: e.target.value as string[]
                    }))
                  }
                  input={<OutlinedInput label="Roles" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((roleId) => (
                        <Chip
                          key={roleId}
                          label={
                            rolesData?.roles.find((r) => r.id === roleId)?.name
                          }
                        />
                      ))}
                    </Box>
                  )}
                >
                  {rolesData?.roles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Box mt={3} display="flex" justifyContent="space-between">
            <Button
              variant="outlined"
              onClick={() => navigate('/management/menus')}
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

export default MenuForm;
