import { useState, useCallback } from 'react';
import {
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Box,
  IconButton,
  Tooltip,
  Typography
} from '@mui/material';
import { useQuery } from '@apollo/client';
import { format } from 'date-fns';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FilterListIcon from '@mui/icons-material/FilterList';
import TelemetryLogDetails from './TelemetryLogDetails';
import {
  GET_DASHBOARD_TELEMETRY_LOGS,
  GET_DASHBOARD_TELEMETRY_LOGS_COUNT
} from 'src/graphql/request';
interface TelemetryLog {
  id: string;
  timestamp: string;
  requestMethod: string;
  endpoint: string;
  input?: string;
  output?: string;
  timeConsumed: number;
  userId?: string;
  handler: string;
}

interface TelemetryLogFilterInput {
  startDate?: Date;
  endDate?: Date;
  requestMethod?: string;
  endpoint?: string;
  userId?: string;
  handler?: string;
  minTimeConsumed?: number;
  maxTimeConsumed?: number;
  search?: string;
}

const TelemetryLogs = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [filter, setFilter] = useState<TelemetryLogFilterInput>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const { data: logsData, loading: logsLoading } = useQuery(
    GET_DASHBOARD_TELEMETRY_LOGS,
    {
      variables: { filter },
      fetchPolicy: 'network-only'
    }
  );

  const { data: countData } = useQuery(GET_DASHBOARD_TELEMETRY_LOGS_COUNT, {
    variables: { filter }
  });

  const handlePageChange = (
    event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setPage(newPage);
  };

  const handleFilterChange =
    (field: keyof TelemetryLogFilterInput) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFilter((prev) => ({
        ...prev,
        [field]: event.target.value
      }));
    };

  const handleCloseDetails = useCallback(() => {
    setSelectedLogId(null);
  }, []);

  const logs = logsData?.dashboardTelemetryLogs || [];
  const totalCount = countData?.dashboardTelemetryLogsCount || 0;

  return (
    <>
      <Card>
        <Box
          p={2}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="h6">Telemetry Logs</Typography>
          <IconButton onClick={() => setShowFilters(!showFilters)}>
            <FilterListIcon />
          </IconButton>
        </Box>

        {showFilters && (
          <Box p={2} display="flex" gap={2} flexWrap="wrap">
            <TextField
              label="Method"
              size="small"
              value={filter.requestMethod || ''}
              onChange={handleFilterChange('requestMethod')}
            />
            <TextField
              label="Endpoint"
              size="small"
              value={filter.endpoint || ''}
              onChange={handleFilterChange('endpoint')}
            />
            <TextField
              label="Handler"
              size="small"
              value={filter.handler || ''}
              onChange={handleFilterChange('handler')}
            />
            <TextField
              label="User ID"
              size="small"
              value={filter.userId || ''}
              onChange={handleFilterChange('userId')}
            />
          </Box>
        )}

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Endpoint</TableCell>
                <TableCell>Handler</TableCell>
                <TableCell>Time (ms)</TableCell>
                <TableCell>User ID</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logsLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log: TelemetryLog) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                    </TableCell>
                    <TableCell>{log.requestMethod}</TableCell>
                    <TableCell>{log.endpoint}</TableCell>
                    <TableCell>{log.handler}</TableCell>
                    <TableCell>{log.timeConsumed}</TableCell>
                    <TableCell>{log.userId || '-'}</TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => setSelectedLogId(log.id)}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10]}
        />
      </Card>

      <TelemetryLogDetails
        open={!!selectedLogId}
        onClose={handleCloseDetails}
        logId={selectedLogId}
      />
    </>
  );
};

export default TelemetryLogs;
