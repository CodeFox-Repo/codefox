import {
  Box,
  Button,
  Container,
  Grid,
  TextField,
  Typography,
  Paper,
  Alert
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { LOGIN } from '../../../graphql/request';
import { useNavigate } from 'react-router-dom';
import { LocalStore } from 'src/lib/storage';

const LoginPaper = styled(Paper)(
  ({ theme }) => `
    padding: ${theme.spacing(4)};
    max-width: 400px;
    margin: 0 auto;
`
);

const FormTextField = styled(TextField)(
  ({ theme }) => `
    margin-bottom: ${theme.spacing(2)};
`
);

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [login, { loading }] = useMutation(LOGIN, {
    onCompleted: (data) => {
      const { accessToken, refreshToken } = data.login;
      localStorage.setItem(LocalStore.accessToken, accessToken);
      localStorage.setItem(LocalStore.refreshToken, refreshToken);
      navigate('/dashboard/overview');
    },
    onError: (error) => {
      setError(error.message);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    console.log('Logging in with:', { email, password });
    try {
      await login({
        variables: {
          input: {
            email,
            password
          }
        }
      });
    } catch (err) {
      // Error is handled by onError above
    }
  };

  return (
    <Container maxWidth="lg" sx={{ textAlign: 'center', mt: 8 }}>
      <LoginPaper elevation={3}>
        <Typography variant="h4" gutterBottom>
          Admin Login
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <form onSubmit={handleSubmit}>
          <FormTextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <FormTextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </LoginPaper>
    </Container>
  );
}

export default Login;
