import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
    Autocomplete,
    Box,
    Button,
    Chip,
    Container,
    Paper,
    Tab,
    Tabs,
    TextField,
    Typography,
    Alert,
    CircularProgress,
} from '@mui/material';

interface Attribute {
    id: string;
    name: string;
    type: string;
}

interface ProfileValue {
    id: string;
    attributeId: string;
    value: string;
    version: number;
    attribute: Attribute;
}

interface Project {
    id: string;
    name: string;
    description: string;
    tags: string[];
}

interface UserData {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    projects: Project[];
    profileValues: ProfileValue[];
}

const DEMO_USER_ID = 'demo-user-123';

export const UserProfile: React.FC = () => {
    const [tabIndex, setTabIndex] = useState(0);
    const [user, setUser] = useState<UserData | null>(null);
    const [profileValues, setProfileValues] = useState<Record<string, { value: string; version: number }>>({});
    const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
    const [allTags, setAllTags] = useState<string[]>([]);

    const [newProject, setNewProject] = useState({ name: '', description: '', tags: [] as string[] });
    const [saveStatus, setSaveStatus] = useState<string | null>(null);

    const loadProfile = useCallback(() => {
        axios
            .get<UserData>(`http://localhost:5000/api/profile/${DEMO_USER_ID}`)
            .then((res) => {
                setUser(res.data);
                const valueMap: Record<string, { value: string; version: number }> = {};
                res.data.profileValues.forEach((pv) => {
                    valueMap[pv.attributeId] = { value: pv.value, version: pv.version };
                });
                setProfileValues(valueMap);
            })
            .catch((err) => console.error('Error loading profile:', err));
    }, []);

    const loadTags = useCallback(() => {
        axios
            .get<string[]>('http://localhost:5000/api/tags')
            .then((res) => setAllTags(res.data))
            .catch((err) => console.error('Error loading tags:', err));
    }, []);

    useEffect(() => {
        loadProfile();
        loadTags();
    }, [loadProfile, loadTags]);

    // Автосохранение (Auto-Save)
    useEffect(() => {
        const timer = setInterval(async () => {
            const attributeIdsToSave = Object.keys(pendingChanges);
            if (attributeIdsToSave.length === 0) return;

            setSaveStatus('Saving changes...');

            for (const attrId of attributeIdsToSave) {
                const newValue = pendingChanges[attrId];
                const currentVersion = profileValues[attrId]?.version || 1;

                try {
                    const res = await axios.put('http://localhost:5000/api/profile/values', {
                        userId: DEMO_USER_ID,
                        attributeId: attrId,
                        value: newValue,
                        version: currentVersion,
                    });

                    setProfileValues((prev) => ({
                        ...prev,
                        [attrId]: { value: res.data.value, version: res.data.version },
                    }));

                    setPendingChanges((prev) => {
                        const next = { ...prev };
                        delete next[attrId];
                        return next;
                    });

                    setSaveStatus('All changes saved!');
                    setTimeout(() => setSaveStatus(null), 3000);
                } catch (err: unknown) {
                    if (axios.isAxiosError(err) && err.response?.status === 409) {
                        alert(err.response.data.error);
                    }
                    setSaveStatus('Error saving changes');
                }
            }
        }, 5000);

        return () => clearInterval(timer);
    }, [pendingChanges, profileValues]);

    const handleAttributeChange = (attrId: string, val: string) => {
        setPendingChanges((prev) => ({ ...prev, [attrId]: val }));
    };

    const handleAddProject = async () => {
        if (!newProject.name) return;
        try {
            await axios.post('http://localhost:5000/api/projects', {
                userId: DEMO_USER_ID,
                ...newProject,
                startDate: new Date(),
            });
            setNewProject({ name: '', description: '', tags: [] });
            loadProfile();
            loadTags();
        } catch (err) {
            console.error('Error adding project:', err);
        }
    };

    if (!user) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 5 }} />;

    return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
            <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h4">Personal Profile</Typography>
                    {saveStatus && <Alert severity="info">{saveStatus}</Alert>}
                </Box>

                <Tabs value={tabIndex} onChange={(_, val) => setTabIndex(val)} sx={{ mb: 3 }}>
                    <Tab label="Me" />
                    <Tab label="Info (Attributes)" />
                    <Tab label="Projects" />
                    <Tab label="CVs" />
                </Tabs>

                {/* Вкладка 1: ME */}
                {tabIndex === 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField label="First Name" value={user.firstName} disabled fullWidth />
                        <TextField label="Last Name" value={user.lastName} disabled fullWidth />
                        <TextField label="Email" value={user.email} disabled fullWidth />
                    </Box>
                )}

                {/* Вкладка 2: INFO */}
                {tabIndex === 1 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            Changes are saved automatically every 5 seconds.
                        </Typography>
                        {user.profileValues.length === 0 ? (
                            <Typography color="text.secondary">No attributes assigned yet.</Typography>
                        ) : (
                            user.profileValues.map((pv) => (
                                <TextField
                                    key={pv.attributeId}
                                    label={pv.attribute.name}
                                    value={pendingChanges[pv.attributeId] ?? profileValues[pv.attributeId]?.value ?? ''}
                                    onChange={(e) => handleAttributeChange(pv.attributeId, e.target.value)}
                                    fullWidth
                                />
                            ))
                        )}
                    </Box>
                )}

                {/* Вкладка 3: PROJECTS */}
                {tabIndex === 2 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>Add New Project</Typography>
                            <TextField
                                label="Project Name"
                                value={newProject.name}
                                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                fullWidth
                                sx={{ mb: 2 }}
                            />
                            <TextField
                                label="Description (Markdown supported)"
                                value={newProject.description}
                                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                                multiline
                                rows={3}
                                fullWidth
                                sx={{ mb: 2 }}
                            />
                            <Autocomplete<string, true, undefined, true>
                                multiple
                                freeSolo
                                options={allTags}
                                value={newProject.tags}
                                onChange={(_, newValue) => setNewProject({ ...newProject, tags: newValue as string[] })}
                                renderInput={(params) => (
                                    <TextField {...params} label="Technologies / Tags" placeholder="Type and press Enter" />
                                )}
                                sx={{ mb: 2 }}
                            />
                            <Button variant="contained" onClick={handleAddProject}>Add Project</Button>
                        </Paper>

                        {user.projects.map((proj) => (
                            <Paper key={proj.id} sx={{ p: 2 }}>
                                <Typography variant="h6">{proj.name}</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
                                    {proj.description}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    {proj.tags.map((tag) => (
                                        <Chip key={tag} label={tag} size="small" color="primary" />
                                    ))}
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                )}

                {/* Вкладка 4: CVs */}
                {tabIndex === 3 && (
                    <Typography color="text.secondary">
                        Your generated CVs will appear here after interacting with Positions.
                    </Typography>
                )}
            </Paper>
        </Container>
    );
};