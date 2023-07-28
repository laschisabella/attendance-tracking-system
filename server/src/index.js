import restify from 'restify'
import neo4j from 'neo4j-driver'
import dotenv from 'dotenv';
dotenv.config();

const server = restify.createServer()

// Add middleware to parse incoming request bodies
server.use(restify.plugins.bodyParser());

// Connect to Neo4j
const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));
const session = driver.session();

// ROUTES

// Get all employees
server.get('/employees', async (req, res) => {
  try {
    const result = await session.run('MATCH (f:Funcionario) RETURN f');
    const employees = result.records.map(record => record.get('f').properties);
    res.json(employees);
  } catch (error) {
    console.error('Error:', error);
  }
})

// Get employee by cpf
server.get('/employees/:id', async (req, res) => {
  const cpf = req.params.id
  try {
    const result = await session.run(
      'MATCH (f:Funcionario {cpf: $cpf}) RETURN f.nome AS nome',
      { cpf: cpf }
    );
  
    if (result.records.length === 0) {
      console.log('Funcionário não encontrado.');
      return null;
    }
    res.json(result.records)
  } catch (error) {
    console.error('Error:', error);
  } 
})

// Create ponto for employee
server.post('/ponto', async (req, res) => {
  const { cpf, data, hora, tipo } = req.body;

  // Verifica se o valor do atributo "tipo" é válido (entrada ou saida)
  if (tipo !== 'entrada' && tipo !== 'saida') {
    return res.send(400, { error: 'Tipo inválido. Deve ser "entrada" ou "saida".' });
  }

  try {
    const result = await session.run(
      'MATCH (f:Funcionario { cpf: $cpfFuncionario }) ' +
      'CREATE (p:Ponto { data: $data, hora: $hora, tipo: $tipoRegistro, funcionario: $cpfFuncionario }) ' +
      'CREATE (f)-[:REGISTROU]->(p) ' +
      'RETURN p',
      { cpfFuncionario: cpf, data, hora, tipoRegistro: tipo }
    );

    const pontoCriado = result.records[0].get('p').properties;
    res.json(pontoCriado);
  } catch (error) {
    console.error('Error:', error);
    res.send(500, { error: 'Internal Server Error' });
  }
});

// Get all pontos from specific employee
server.get('/pontos/:cpf', async (req, res) => {
  const { cpf } = req.params;
  
  try {
    const result = await session.run(
      'MATCH (f:Funcionario { cpf: $cpfFuncionario })-[:REGISTROU]->(p:Ponto) ' +
      'RETURN p',
      { cpfFuncionario: cpf }
    );

    const pontos = result.records.map(record => record.get('p').properties);
    res.json(pontos);
  } catch (error) {
    console.error('Error:', error);
    res.send(500, { error: 'Internal Server Error' });
  }
});

// Delete all pontos from specific day for specific employee
server.del('/pontos/:cpf/:data', async (req, res) => {
  const { cpf, data } = req.params;

  try {
    const result = await session.run(
      'MATCH (f:Funcionario { cpf: $cpfFuncionario })-[:REGISTROU]->(p:Ponto { data: $dataPonto }) ' +
      'DETACH DELETE p',
      { cpfFuncionario: cpf, dataPonto: data }
    );

    res.send(200, { message: `Pontos registrados no dia ${data} para o funcionário de CPF ${cpf} foram excluídos com sucesso.` });
  } catch (error) {
    console.error('Error:', error);
    res.send(500, { error: 'Internal Server Error' });
  }
});

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`Server running on port ${port}`)
})