import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  TextField,
  Typography,
  Alert,
  Chip,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';

interface CvField {
  attributeId: string;
  name: string;
  category: string;
  isRequired: boolean;
  value: string;
  isMissing: boolean;
}

interface CvGeneratorModalProps {
  open: boolean;
  positionId: string | null;
  userId: string;
  onClose: () => void;
}

export const CvGeneratorModal: React.FC<CvGeneratorModalProps> = ({
  open,
  positionId,
  userId,
  onClose,
}) => {
  const [positionTitle, setPositionTitle] = useState('');
  const [fields, setFields] = useState<CvField[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!open || !positionId) return;

    let isMounted = true;

    const loadCv = async () => {
      try {
        setLoading(true);
        setSaveSuccess(false);

        const res = await axios.post('http://localhost:5000/api/cvs/generate', { userId, positionId });
        if (isMounted) {
          setPositionTitle(res.data.positionTitle);
          setFields(res.data.fields);
        }
      } catch (err) {
        console.error('Error generating CV:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadCv();

    return () => {
      isMounted = false;
    };
  }, [open, positionId, userId]);

  const handleFieldValueChange = (attrId: string, newValue: string) => {
    setFields((prevFields) =>
      prevFields.map((field) => {
        if (field.attributeId === attrId) {
          const isMissing = field.isRequired && !newValue.trim();
          return { ...field, value: newValue, isMissing };
        }
        return field;
      })
    );
  };

  const handleSaveCv = async () => {
    try {
      for (const field of fields) {
        await axios.put('http://localhost:5000/api/profile/values', {
          userId,
          attributeId: field.attributeId,
          value: field.value,
          version: 1,
        });
      }
      setSaveSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error saving CV fields:', err);
    }
  };

  const missingCount = fields.filter((f) => f.isMissing).length;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>
        Generated CV for: {positionTitle}
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {loading ? (
          <Typography sx={{ my: 4 }} align="center">
            Generating CV tailored to vacancy...
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {missingCount > 0 ? (
              <Alert severity="warning" icon={<WarningAmberIcon />}>
                Attention: <strong>{missingCount}</strong> required attribute(s) are missing! Please fill them below (highlighted in red).
              </Alert>
            ) : (
              <Alert severity="success" icon={<CheckCircleOutlinedIcon />}>
                All required attributes for this position are successfully filled!
              </Alert>
            )}

            <Typography variant="h6" sx={{ mt: 1 }}>
              CV Content (In-Place Edit)
            </Typography>

            {fields.map((field) => (
              <Paper
                key={field.attributeId}
                variant="outlined"
                sx={{
                  p: 2,
                  borderColor: field.isMissing ? 'error.main' : 'divider',
                  bgcolor: field.isMissing ? '#fff8f8' : 'background.paper',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    {field.name} {field.isRequired && <span style={{ color: 'red' }}>*</span>}
                  </Typography>
                  <Chip label={field.category} size="small" variant="outlined" />
                </Box>

                <TextField
                  fullWidth
                  value={field.value}
                  placeholder={field.isMissing ? 'Required field! Fill here directly...' : ''}
                  error={field.isMissing}
                  helperText={field.isMissing ? 'This field is required for the position' : ''}
                  onChange={(e) => handleFieldValueChange(field.attributeId, e.target.value)}
                />
              </Paper>
            ))}

            {saveSuccess && <Alert severity="success">CV & Profile updated successfully!</Alert>}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          color={missingCount > 0 ? 'warning' : 'primary'}
          onClick={handleSaveCv}
          disabled={loading}
        >
          {missingCount > 0 ? 'Save & Complete Missing Fields' : 'Save Final CV'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};