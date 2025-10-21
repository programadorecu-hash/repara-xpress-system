import React, { useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await axios.post('http://localhost:8000/token', formData);

      // Usamos la función de nuestro Context para guardar el token
      login(response.data.access_token);

      // Redirigimos al usuario a la selección de turno
      navigate('/iniciar-turno');

    } catch (err) {
      setError('Email o contraseña incorrectos.');
    }
  };

  return (
    // El JSX del formulario se mantiene igual que antes
    <div className="flex items-center justify-center min-h-screen bg-primary">
      <div className="p-8 bg-white rounded-lg shadow-lg w-full max-w-md border">
        <h2 className="text-3xl font-bold text-center text-secondary mb-6">Iniciar Sesión</h2>
        <form onSubmit={handleSubmit}>
          {error && <p className="bg-red-200 text-red-800 p-3 rounded-lg mb-4">{error}</p>}
          <div className="mb-4">
            <label className="block text-gray-500 mb-2" htmlFor="email">Correo Electrónico</label>
            <input type="email" id="email" className="w-full p-3 bg-gray-100 rounded-lg text-secondary border border-gray-300 focus:outline-none focus:border-detail" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="mb-6">
            <label className="block text-gray-500 mb-2" htmlFor="password">Contraseña</label>
            <input type="password" id="password" className="w-full p-3 bg-gray-100 rounded-lg text-secondary border border-gray-300 focus:outline-none focus:border-detail" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="w-full bg-accent hover:bg-teal-500 text-white font-bold py-3 rounded-lg transition duration-300">Ingresar</button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;