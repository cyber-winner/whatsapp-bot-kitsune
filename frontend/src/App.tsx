import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Login from './pages/Login.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Trainer from './pages/Trainer.tsx';
import Home from './pages/Home.tsx';
import Layout from './components/Layout.tsx';
import UserLogin from './pages/UserLogin.tsx';
import WebGame from './pages/WebGame.tsx';
import Shop from './pages/Shop.tsx';

export default function App() {
  const [auth, setAuth] = useState<string>('');

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trainer" element={<Trainer />} />
        <Route path="/login" element={<UserLogin />} />
        <Route path="/play" element={<WebGame />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/control-centre" element={auth ? <Navigate to="/control-centre/dashboard" /> : <Login setAuth={setAuth} />} />
        <Route path="/control-centre/dashboard" element={auth ? <Layout setAuth={setAuth} /> : <Navigate to="/control-centre" />}>
          <Route index element={<Dashboard auth={auth} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
