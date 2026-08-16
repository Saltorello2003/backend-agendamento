require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(cors());

// Conexão com Banco de Dados PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-agendamento-123';

// Middleware para verificar se o usuário é Admin
function autenticarToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Acesso negado' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = decoded;
    next();
  });
}

// Inicializar tabelas do banco de dados
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin'
      );

      CREATE TABLE IF NOT EXISTS agendamentos (
        id SERIAL PRIMARY KEY,
        cliente_nome VARCHAR(255) NOT NULL,
        cliente_telefone VARCHAR(50) NOT NULL,
        servico VARCHAR(255) NOT NULL,
        data DATE NOT NULL,
        horario VARCHAR(20) NOT NULL,
        status VARCHAR(50) DEFAULT 'pendente',
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Criar o usuário Admin padrão se não existir
    const res = await pool.query('SELECT * FROM usuarios WHERE email = $1', ['saltorello2003@gmail.com']);
    if (res.rows.length === 0) {
      const senhaHash = await bcrypt.hash('123456', 10);
      await pool.query('INSERT INTO usuarios (email, senha, role) VALUES ($1, $2, $3)', [
        'saltorello2003@gmail.com',
        senhaHash,
        'admin'
      ]);
      console.log('✅ Usuário Admin padrão criado com sucesso!');
    }
  } catch (err) {
    console.error('Erro ao inicializar Banco de Dados:', err);
  }
}
initDB();

// ------------------- ROTAS DA API -------------------

// 1. Rota de Login Admin
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'E-mail ou senha incorretos' });
    }

    const usuario = result.rows[0];
    const senhaValida = await bcrypt.compare(password, usuario.senha);
    if (!senhaValida) {
      return res.status(400).json({ message: 'E-mail ou senha incorretos' });
    }

    const token = jwt.sign({ id: usuario.id, email: usuario.email }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { email: usuario.email } });
  } catch (err) {
    res.status(500).json({ message: 'Erro interno no servidor' });
  }
});

// 2. Rota para Criar Agendamento (Pública)
app.post('/api/agendamentos', async (req, res) => {
  const { nome, telefone, servico, data, horario } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO agendamentos (cliente_nome, cliente_telefone, servico, data, horario) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nome, telefone, servico, data, horario]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao criar agendamento' });
  }
});

// 3. Rota para Buscar Agendamentos (Protegida)
app.get('/api/agendamentos', autenticarToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM agendamentos ORDER BY data ASC, horario ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar agendamentos' });
  }
});

// Inicialização do Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));