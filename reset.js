const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// Cole a "External Database URL" do Render no lugar abaixo:
const connectionString = 'postgresql://banco_agendamento_gmpt_user:6qFf7Y9S1qqL9Fy9mMihTfsesRaw9O73@dpg-da0sobtg1s2s73cck79g-a.ohio-postgres.render.com/banco_agendamento_gmpt';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function resetar() {
  const email = 'saltorello2003@gmail.com';
  const novaSenha = 'admin123'; // Defina a nova senha desejada aqui
  const hash = await bcrypt.hash(novaSenha, 10);

  const query = `
    INSERT INTO usuarios (email, senha, tipo) 
    VALUES ($1, $2, 'admin')
    ON CONFLICT (email) 
    DO UPDATE SET senha = $2;
  `;

  try {
    await pool.query(query, [email, hash]);
    console.log(`✅ Senha alterada com sucesso! E-mail: ${email} | Senha: ${novaSenha}`);
  } catch (err) {
    console.error('❌ Erro ao redefinir:', err);
  } finally {
    pool.end();
  }
}

resetar();