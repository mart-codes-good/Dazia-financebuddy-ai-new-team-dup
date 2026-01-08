// src/App.jsx
import React from 'react';
import { CourseProvider } from './context/CourseContext';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardLayout from './components/DashboardLayout';

function App() {
  return (
    <ErrorBoundary>
      <CourseProvider>
        <DashboardLayout />
      </CourseProvider>
    </ErrorBoundary>
  );
}

export default App;
