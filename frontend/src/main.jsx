import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom'; // 1. Importa el Router
import { AuthProvider } from './context/AuthContext.jsx'; // 2. Importa el AuthProvider

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>   {/* 3. Envuelve todo en el Router */}
      <AuthProvider>  {/* 4. Envuelve todo en el AuthProvider */}
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);