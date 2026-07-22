import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  Checkbox,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import { CvGeneratorModal } from './CvGeneratorModal';

interface Attribute {
  id: string;
  name: string;
  category: string;
}

interface PositionAttribute {
  attributeId: string;
  isRequired: boolean;
  isHidden: boolean;
  attribute: Attribute;
}

interface Position {
  id: string;
  title: string;
  description: string;
  attributes: PositionAttribute[];
}

export const PositionList: React.FC = () => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [availableAttributes, setAvailableAttributes] = useState<Attribute[]>([]);
  const [openModal, setOpenModal] = useState(false);

  // Стейты для модалки CV
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [openCvModal, setOpenCvModal] = useState(false);

  // Форма новой вакансии
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAttrMap, setSelectedAttrMap] = useState<
    Record<string, { selected: boolean; isRequired: boolean; isHidden: boolean }>
  >({});

  const fetchData = useCallback(() => {
    Promise.all([
      axios.get('http://localhost:5000/api/positions'),
      axios.get('http://localhost:5000/api/attributes'),
    ])
      .then(([posRes, attrRes]) => {
        setPositions(posRes.data);
        setAvailableAttributes(attrRes.data);

        const initialMap: Record<string, { selected: boolean; isRequired: boolean; isHidden: boolean }> = {};
        attrRes.data.forEach((attr: Attribute) => {
          initialMap[attr.id] = { selected: false, isRequired: false, isHidden: false };
        });
        setSelectedAttrMap(initialMap);
      })
      .catch((err) => console.error('Error fetching position data:', err));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreatePosition = async () => {
    if (!title) return;

    const attributesToAttach = Object.entries(selectedAttrMap)
      .filter(([, val]) => val.selected)
      .map(([attrId, val]) => ({
        attributeId: attrId,
        isRequired: val.isRequired,
        isHidden: val.isHidden,
      }));

    try {
      await axios.post('http://localhost:5000/api/positions', {
        title,
        description,
        attributes: attributesToAttach,
      });

      setOpenModal(false);
      setTitle('');
      setDescription('');
      fetchData();
    } catch (err) {
      console.error('Error creating position:', err);
    }
  };

  const handleOpenCvModal = (posId: string) => {
    setSelectedPositionId(posId);
    setOpenCvModal(true);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h5" gutterBottom>
          Open Positions (Vacancies)
        </Typography>

        <Toolbar sx={{ mb: 2 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenModal(true)}>
            Create Position
          </Button>
        </Toolbar>

        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Position Title</strong></TableCell>
                <TableCell><strong>Description</strong></TableCell>
                <TableCell><strong>Attributes Configuration</strong></TableCell>
                <TableCell align="right"><strong>Action</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {positions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    No positions created yet.
                  </TableCell>
                </TableRow>
              ) : (
                positions.map((pos) => (
                  <TableRow key={pos.id}>
                    <TableCell>{pos.title}</TableCell>
                    <TableCell>{pos.description || '-'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {pos.attributes.map((pa) => (
                          <Chip
                            key={pa.attributeId}
                            label={`${pa.attribute.name}${pa.isRequired ? ' *' : ''}`}
                            color={pa.isRequired ? 'error' : 'default'}
                            size="small"
                            variant={pa.isHidden ? 'outlined' : 'filled'}
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DescriptionIcon />}
                        onClick={() => handleOpenCvModal(pos.id)}
                      >
                        Generate CV
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Модальное окно создания Вакансии */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} fullWidth maxWidth="md">
        <DialogTitle>Create New Position</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Position Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />

            <Typography variant="h6" sx={{ mt: 1 }}>
              Select & Configure Attributes for Position
            </Typography>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">Attach</TableCell>
                    <TableCell>Attribute Name</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="center">Is Required (*)</TableCell>
                    <TableCell align="center">Is Hidden</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {availableAttributes.map((attr) => {
                    const cfg = selectedAttrMap[attr.id] || { selected: false, isRequired: false, isHidden: false };
                    return (
                      <TableRow key={attr.id}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={cfg.selected}
                            onChange={(e) =>
                              setSelectedAttrMap((prev) => ({
                                ...prev,
                                [attr.id]: { ...cfg, selected: e.target.checked },
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell>{attr.name}</TableCell>
                        <TableCell>{attr.category}</TableCell>
                        <TableCell align="center">
                          <Checkbox
                            disabled={!cfg.selected}
                            checked={cfg.isRequired}
                            onChange={(e) =>
                              setSelectedAttrMap((prev) => ({
                                ...prev,
                                [attr.id]: { ...cfg, isRequired: e.target.checked },
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Checkbox
                            disabled={!cfg.selected}
                            checked={cfg.isHidden}
                            onChange={(e) =>
                              setSelectedAttrMap((prev) => ({
                                ...prev,
                                [attr.id]: { ...cfg, isHidden: e.target.checked },
                              }))
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenModal(false)}>Cancel</Button>
          <Button onClick={handleCreatePosition} variant="contained" disabled={!title}>
            Save Position
          </Button>
        </DialogActions>
      </Dialog>

      {/* Модальное окно генерации CV */}
      <CvGeneratorModal
        open={openCvModal}
        positionId={selectedPositionId}
        userId="demo-user-123"
        onClose={() => setOpenCvModal(false)}
      />
    </Container>
  );
};