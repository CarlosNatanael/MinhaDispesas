// Exemplo GET
axios.get('http://<IP>:5000/api/gastos', {
  params: { usuario_id: 1 }
}).then(res => console.log(res.data));

// Exemplo POST
axios.post('http://<IP>:5000/api/gastos', {
  usuario_id: 1,
  titulo: 'Almoço',
  valor: 25.00,
  tipo: 'despesa',
  data: '2025-07-01'
});
