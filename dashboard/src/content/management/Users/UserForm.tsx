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
import {
  GET_DASHBOARD_USER,
  CREATE_DASHBOARD_USER,
  UPDATE_DASHBOARD_USER,
  GET_DASHBOARD_ROLES
} from 'src/graphql/request';

const UserForm: FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    roleIds: [] as string[]
  });

  const { data: rolesData } = useQuery(GET_DASHBOARD_ROLES);
  const { data: userData } = useQuery(GET_DASHBOARD_USER, {
    variables: { id },
    skip: !id
  });

  const [createUser] = useMutation(CREATE_DASHBOARD_USER);
  const [updateUser] = useMutation(UPDATE_DASHBOARD_USER);

  useEffect(() => {
    if (userData?.dashboardUser) {
      setFormData({
        username: userData.dashboardUser.username,
        email: userData.dashboardUser.email,
        password: '',
        roleIds: userData.dashboardUser.roles.map((role) => role.id)
      });
    }
  }, [userData]);

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
        const input = {
          ...formData,
          ...(formData.password ? { password: formData.password } : {})
        };
        await updateUser({
          variables: {
            id,
            input
          }
        });
      } else {
        await createUser({
          variables: {
            input: formData
          }
        });
      }
      navigate('/management/users');
    } catch (error) {
      console.error('Error saving user:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <Box p={3}>
          <Typography variant="h4">
            {isEdit ? 'Edit User' : 'Create User'}
          </Typography>
        </Box>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                type="email"
                label="Email"
                name="email"
                value={formData.email}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="password"
                label={isEdit ? 'New Password (optional)' : 'Password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required={!isEdit}
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
                            rolesData?.dashboardRoles.find(
                              (r) => r.id === roleId
                            )?.name
                          }
                        />
                      ))}
                    </Box>
                  )}
                >
                  {rolesData?.dashboardRoles.map((role) => (
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
              onClick={() => navigate('/management/users')}
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

export default UserForm;
