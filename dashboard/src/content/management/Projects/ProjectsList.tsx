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
  Button,
  Link
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useQuery, useMutation } from '@apollo/client';
import {
  GET_DASHBOARD_PROJECTS,
  DELETE_DASHBOARD_PROJECT
} from 'src/graphql/request';

const ProjectsList: FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);

  // 查询项目列表
  const { data, loading, error, refetch } = useQuery(GET_DASHBOARD_PROJECTS);

  // 删除项目 Mutation
  const [deleteProject] = useMutation(DELETE_DASHBOARD_PROJECT, {
    onCompleted: () => refetch(),
    onError: (err) => console.error('Delete project error:', err)
  });

  const handlePageChange = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (event: any) => {
    setLimit(parseInt(event.target.value));
    setPage(0);
  };

  // 删除操作
  const handleDelete = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      await deleteProject({ variables: { id: projectId } });
    }
  };

  // 从查询数据中获取项目列表
  const projects = data?.dashboardProjects || [];
  const paginatedProjects = projects.slice(page * limit, page * limit + limit);

  return (
    <>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        p={2}
      >
        <Typography variant="h3">Projects Management</Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/management/projects/create')}
        >
          Create Project
        </Button>
      </Box>
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Project Name</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Path</TableCell>
                <TableCell>Chats</TableCell>
                <TableCell>Packages</TableCell>
                <TableCell>Visibility</TableCell>
                <TableCell>Created Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9}>Loading...</TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={9}>Error: {error.message}</TableCell>
                </TableRow>
              ) : paginatedProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>No projects found</TableCell>
                </TableRow>
              ) : (
                paginatedProjects.map((project: any) => (
                  <TableRow hover key={project.id}>
                    <TableCell>{project.projectName}</TableCell>
                    <TableCell>
                      {project.user ? project.user.username : '-'}
                    </TableCell>
                    <TableCell>
                      {project.path ? (
                        <Link
                          href={project.path}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {project.path}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {project.chats ? project.chats.length : 0}
                    </TableCell>
                    <TableCell>
                      {project.projectPackages
                        ? project.projectPackages.length
                        : 0}
                    </TableCell>
                    <TableCell>
                      {project.isPublic ? 'Public' : 'Private'}
                    </TableCell>
                    <TableCell>
                      {project.createdAt
                        ? format(new Date(project.createdAt), 'yyyy-MM-dd')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={project.isActive ? 'Active' : 'Inactive'}
                        color={project.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() =>
                            navigate(`/management/projects/view/${project.id}`)
                          }
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() =>
                            navigate(`/management/projects/edit/${project.id}`)
                          }
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(project.id)}
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
            count={projects.length}
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

export default ProjectsList;
