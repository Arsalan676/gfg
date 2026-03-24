import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VerifyIdle from './components/VerifyIdle';
import VerifyLive from './components/VerifyLive';
import JobDetail from './components/JobDetail';
import JobHistory from './components/JobHistory';

export default function App() {
  return (
    <Router>
<Routes>
        <Route path="/" element={<VerifyIdle />} />
        <Route path="/live" element={<VerifyLive />} />
        <Route path="/history" element={<JobHistory />} />
        <Route path="/detail/:job_id" element={<JobDetail />} />
        <Route path="/detail" element={<JobDetail />} />
      </Routes>
    </Router>
  );
}
