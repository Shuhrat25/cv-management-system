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
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

interface Attribute {
  id: string;
  name: string;
  category: string;
  type: string;
  description: string;
}

const CATEGORIES = ['CERTIFICATION', 'DOMAIN_KNOWLEDGE', 'PERSONAL_INFO', 'SOFT_SKILLS'];
const TYPES = ['STRING', 'TEXT', 'IMAGE', 'NUMERIC', 'DATE', 'PERIOD', 'BOOLEAN', 'DROPDOWN'];

export const AttributeLibrary: React.FC = () => {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openModal, setOpenModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    category: 'SOFT_SKILLS',
    type: 'STRING',
    description: '',
  });

  const fetchAttributes = useCallback(() => {
    axios
      .get('http://localhost:5000/api/attributes')
      .then((res) => setAttributes(res.data))
      .catch((err) => console.error('Error fetching attributes:', err));
  }, []);

  useEffect(() => {
    fetchAttributes();
  }, [fetchAttributes]);

  const handleCreate = async () => {
    try {
      await axios.post('http://localhost:5000/api/attributes', formData);
      setOpenModal(false);
      setFormData({ name: '', category: 'SOFT_SKILLS', type: 'STRING', description: '' });
      fetchAttributes();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        alert(err.response?.data?.error || 'Failed to create attribute');
      } else {
        alert('An unexpected error occurred');
      }
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} items?`)) return;

    try {
      await axios.post('http://localhost:5000/api/attributes/delete-many', { ids: selectedIds });
      setSelectedIds([]);
      fetchAttributes();
    } catch (err) {
      console.error('Error deleting attributes:', err);
    }
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(attributes.map((attr) => attr.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Attribute Library
        </Typography>

        {/* Тулбар над таблицей */}
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 }, bgcolor: 'background.default', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenModal(true)}
            sx={{ mr: 2 }}
          >
            Create Attribute
          </Button>

          {selectedIds.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteSelected}
            >
              Delete Selected ({selectedIds.length})
            </Button>
          )}
        </Toolbar>

        {/* Таблица без кнопок действий в строках */}
        <TableContainer component={Paper} variant="outlined">
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedIds.length > 0 && selectedIds.length < attributes.length}
                    checked={attributes.length > 0 && selectedIds.length === attributes.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Category</strong></TableCell>
                <TableCell><strong>Data Type</strong></TableCell>
                <TableCell><strong>Description</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {attributes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No attributes found. Click "Create Attribute" to add one.
                  </TableCell>
                </TableRow>
              ) : (
                attributes.map((row) => {
                  const isItemSelected = selectedIds.includes(row.id);
                  return (
                    <TableRow
                      key={row.id}
                      hover
                      onClick={() => handleSelectRow(row.id)}
                      role="checkbox"
                      aria-checked={isItemSelected}
                      selected={isItemSelected}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox checked={isItemSelected} />
                      </TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell>{row.description || '-'}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Модальное окно создания атрибута */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create New Attribute</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Attribute Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                label="Category"
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {CATEGORIES.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.type}
                label="Type"
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                {TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenModal(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" disabled={!formData.name}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};