import { useState } from 'react';
import { AttributeLibrary } from './components/AttributeLibrary';
import { UserProfile } from './components/UserProfile';
import { PositionList } from './components/PositionList';
import { AppBar, Toolbar, Button, Typography, Container, CssBaseline, ThemeProvider, createTheme } from '@mui/material';

const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

function App() {
  const [currentView, setCurrentView] = useState<'attributes' | 'profile' | 'positions'>('attributes');

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            CV Management System
          </Typography>
          <Button color="inherit" onClick={() => setCurrentView('attributes')}>
            Attribute Library
          </Button>
          <Button color="inherit" onClick={() => setCurrentView('positions')}>
            Positions
          </Button>
          <Button color="inherit" onClick={() => setCurrentView('profile')}>
            My Profile
          </Button>
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 2 }}>
        {currentView === 'attributes' && <AttributeLibrary />}
        {currentView === 'positions' && <PositionList />}
        {currentView === 'profile' && <UserProfile />}
      </Container>
    </ThemeProvider>
  );
}

export default App;