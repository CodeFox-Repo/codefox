import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  CircularProgress
} from '@mui/material';
import { format } from 'date-fns';
import { useQuery } from '@apollo/client';
import { GET_DASHBOARD_TELEMETRY_LOG } from 'src/graphql/request';

interface TelemetryLogDetailsProps {
  open: boolean;
  onClose: () => void;
  logId: string | null;
}

const DataSection = ({
  title,
  content
}: {
  title: string;
  content: string;
}) => (
  <Box mb={2}>
    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
      {title}
    </Typography>
    <Paper
      variant="outlined"
      sx={{ p: 2, maxHeight: '200px', overflow: 'auto' }}
    >
      <pre
        style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {content}
      </pre>
    </Paper>
  </Box>
);

const TelemetryLogDetails: React.FC<TelemetryLogDetailsProps> = ({
  open,
  onClose,
  logId
}) => {
  const { data, loading } = useQuery(GET_DASHBOARD_TELEMETRY_LOG, {
    variables: { id: logId },
    skip: !logId
  });

  const log = data?.dashboardTelemetryLog;

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Telemetry Log Details</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : log ? (
          <Box mt={2}>
            <Box display="flex" gap={4} mb={3}>
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Timestamp
                </Typography>
                <Typography>
                  {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Method
                </Typography>
                <Typography>{log.requestMethod}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Time Consumed
                </Typography>
                <Typography>{log.timeConsumed}ms</Typography>
              </Box>
            </Box>

            <DataSection title="Endpoint" content={log.endpoint} />

            {log.input && (
              <DataSection
                title="Request Input"
                content={JSON.stringify(JSON.parse(log.input), null, 2)}
              />
            )}

            {log.output && (
              <DataSection
                title="Response Output"
                content={JSON.stringify(JSON.parse(log.output), null, 2)}
              />
            )}

            <Box display="flex" gap={4} mt={3}>
              <Box>
                <Typography variant="caption" color="textSecondary">
                  User ID
                </Typography>
                <Typography>{log.userId || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Handler
                </Typography>
                <Typography>{log.handler}</Typography>
              </Box>
            </Box>
          </Box>
        ) : (
          <Typography color="error">Log not found</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TelemetryLogDetails;
