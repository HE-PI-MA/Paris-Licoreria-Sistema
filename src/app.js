const express = require('express');
const helmet = require('helmet');
const path = require('path');

const SystemRepository = require('./repositories/SystemRepository');
const SystemService = require('./services/SystemService');
const SystemController = require('./controllers/SystemController');
const SystemRoutes = require('./routes/system.routes');

class App {
  constructor() {
    this.app = express();

    this.configureApplication();
    this.configureDependencies();
    this.configureRoutes();
    this.configureErrors();
  }

  configureApplication() {
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, '..', 'views'));

    this.app.use(helmet());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, '..', 'public')));
  }

  configureDependencies() {
    const systemRepository = new SystemRepository();
    const systemService = new SystemService(systemRepository);

    this.systemController = new SystemController(systemService);
  }

  configureRoutes() {
    const systemRoutes = new SystemRoutes(this.systemController);

    this.app.get('/', (req, res) => {
      res.json({
        application: 'Paris Licoreria Sistema',
        message: 'Servidor funcionando',
        architecture: 'POO'
      });
    });

    this.app.use('/api', systemRoutes.getRouter());
  }

  configureErrors() {
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Ruta no encontrada' });
    });

    this.app.use((error, req, res, next) => {
      console.error(error);
      res.status(500).json({ error: 'Error interno del servidor' });
    });
  }

  getExpressApp() {
    return this.app;
  }
}

module.exports = App;
