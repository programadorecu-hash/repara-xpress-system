import api from './api';

export async function fetchLostSales(params = {}) {
  const response = await api.get('/lost-sales/', { params });
  return response.data;
}

export async function createLostSaleLog(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('A payload object is required to create a lost sale log');
  }

  const response = await api.post('/lost-sales/', payload);
  return response.data;
}

