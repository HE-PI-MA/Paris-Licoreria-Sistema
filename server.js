require('dotenv').config();

const App = require('./src/app');
const database = require('./src/config/database');

class Server {
  constructor() {
    this.port = Number(process.env.PORT || 3000);
    this.application = new App().getExpressApp();
    this.server = null;
  }

  async start() {
    try {
      await database.testConnection();
      console.log('MYSQL: CONEXION CORRECTA');

      this.server = this.application.listen(this.port, () => {
        console.log('======================================');
        console.log(' PARIS LICORERIA - SISTEMA');
        console.log('======================================');
        console.log(' Servidor: http://localhost:' + this.port);
        console.log(' Estado:   http://localhost:' + this.port + '/api/estado');
        console.log(' Arquitectura: POO');
        console.log('======================================');
      });
    } catch (error) {
      console.error('');
      console.error('NO SE PUDO INICIAR EL SISTEMA');
      console.error('MYSQL: ' + error.message);
      console.error('');
      process.exit(1);
    }
  }
}

const server = new Server();
server.start();
